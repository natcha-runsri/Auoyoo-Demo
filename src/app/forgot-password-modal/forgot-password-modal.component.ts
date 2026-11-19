import { Component, ElementRef, Injector, OnDestroy, ViewChild, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, finalize, timer } from 'rxjs';
import { PasswordResetService } from '../services/password-reset/password-reset.service';
import { AuthModalService } from '../services/auth-modal/auth-modal.service';
import { AuthService } from '../services/authen/auth.service';
import { OtpInputComponent } from '../components/otp-input/otp-input.component';
import { PasswordResetError } from '../models/password-reset.model';
import { emailValidator, matchFieldsValidator, passwordValidator } from '../validators/auth.validators';

export type ForgotStep = 'email' | 'code' | 'password';

/** ค่าเริ่มต้นถ้า backend ไม่บอกมา (ต้องตรงกับ PasswordResetRateLimiter.COOLDOWN) */
const DEFAULT_RESEND_SECONDS = 60;
export const RESET_SUCCESS_NOTICE = 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ';

/**
 * "ลืมรหัสผ่าน" 3 ขั้นใน modal เดียว (render ใน auth-modal-host เสมอ ไม่มี overlay/ปุ่มปิดของตัวเอง)
 *   1) email     กรอกอีเมล -> ส่งรหัส 6 หลัก (ไปขั้น 2 ทุกกรณี — backend ตอบเหมือนกันไม่ว่ามีบัญชีหรือไม่)
 *   2) code      กรอกรหัส -> ได้ resetToken
 *   3) password  ตั้งรหัสผ่านใหม่ด้วย resetToken -> กลับ popup login พร้อมข้อความสำเร็จ + username
 * ปิด popup กลางทาง = component ถูก destroy -> เปิดใหม่เริ่มขั้น 1 เสมอ
 */
@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, OtpInputComponent],
  templateUrl: './forgot-password-modal.component.html',
  styleUrl: './forgot-password-modal.component.css'
})
export class ForgotPasswordModalComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly passwordReset = inject(PasswordResetService);
  private readonly authModal = inject(AuthModalService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  step: ForgotStep = 'email';
  loading = false;
  /** ข้อความ error รวมของขั้นปัจจุบัน (แสดงในช่องที่จองไว้ใต้ช่องกรอก) */
  errorMessage = '';
  /** ข้อความแจ้งเฉย ๆ (ไม่ใช่ error) เช่น "ส่งรหัสใหม่แล้ว" */
  infoMessage = '';
  submitted = false;

  /** อีเมลที่ขอรหัสไปจริง (ใช้แสดงในขั้น 2 และส่งไปกับ verify/resend) */
  email = '';
  private resetToken = '';

  // ขั้น 2
  otpInvalid = false;
  otpValue = '';
  resendCooldown = 0;
  resending = false;
  private cooldownSub?: Subscription;

  // ขั้น 3
  showPassword = false;
  showConfirm = false;
  /** reset token หมดอายุ/ใช้ไปแล้ว -> ต้องเริ่มใหม่ตั้งแต่ขั้น 1 */
  tokenExpired = false;

  readonly emailForm = this.fb.nonNullable.group({ email: ['', emailValidator] });
  readonly passwordForm = this.fb.nonNullable.group({
    newPassword: ['', passwordValidator],
    confirmPassword: ['']
  }, { validators: matchFieldsValidator('newPassword', 'confirmPassword') });

  @ViewChild(OtpInputComponent) private otp?: OtpInputComponent;
  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('newPasswordInput') private newPasswordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('confirmPasswordInput') private confirmPasswordInput?: ElementRef<HTMLInputElement>;

  ngOnDestroy(): void {
    this.cooldownSub?.unsubscribe();
  }

  // ===== ขั้นที่ 1 =====

  get emailError(): string | null {
    return this.submitted ? this.emailForm.controls.email.getError('message') ?? null : null;
  }

  submitEmail(): void {
    if (this.loading) return;
    this.submitted = true;
    this.errorMessage = '';
    if (this.emailForm.invalid) {
      this.emailInput?.nativeElement.focus();
      return;
    }

    const email = this.emailForm.controls.email.value.trim();
    this.loading = true;
    this.passwordReset.forgotPassword(email).pipe(finalize(() => (this.loading = false))).subscribe({
      next: res => this.goToCodeStep(email, res.resendAfterSeconds),
      error: (err: HttpErrorResponse) => {
        if (err.status === 429) {
          // เพิ่งขอไป/ขอถี่เกิน: รหัสล่าสุดที่ส่งไปยังใช้ได้ -> ไปกรอกรหัสต่อ แล้วรอนับถอยหลังก่อนขอใหม่
          this.goToCodeStep(email, retryAfter(err));
          this.infoMessage = 'เพิ่งส่งรหัสไปแล้ว กรุณาใช้รหัสล่าสุดในอีเมล';
          return;
        }
        this.errorMessage = genericError(err);
      }
    });
  }

  /** ยกเลิก: มาจาก popup login -> กลับ login เหมือนเดิม / ล็อกอินอยู่แล้ว (เช่น มาจากหน้าโปรไฟล์) -> แค่ปิด popup */
  onCancel(): void {
    if (this.auth.isLoggedIn()) {
      this.authModal.close();
      return;
    }
    this.authModal.switchTo('login');
  }

  // ===== ขั้นที่ 2 =====

  get resendLabel(): string {
    const m = Math.floor(this.resendCooldown / 60);
    const s = (this.resendCooldown % 60).toString().padStart(2, '0');
    return `ส่งอีกครั้งได้ใน ${m}:${s}`;
  }

  onOtpChanged(value: string): void {
    this.otpValue = value;
    // เริ่มพิมพ์ใหม่ -> เลิกแดง/ซ่อนข้อความเดิม
    if (this.otpInvalid || this.errorMessage) {
      this.otpInvalid = false;
      this.errorMessage = '';
    }
  }

  /** ครบ 6 หลัก (พิมพ์/วาง/เติมอัตโนมัติ) -> ยืนยันทันที */
  onOtpCompleted(code: string): void {
    this.otpValue = code;
    this.submitCode();
  }

  submitCode(): void {
    if (this.loading) return;
    this.submitted = true;
    this.infoMessage = '';
    if (this.otpValue.length !== 6) {
      this.errorMessage = 'กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก';
      this.otpInvalid = true;
      this.otp?.focus(this.otpValue.length);
      return;
    }

    this.loading = true;
    this.passwordReset.verifyCode(this.email, this.otpValue).pipe(finalize(() => (this.loading = false))).subscribe({
      next: res => {
        this.resetToken = res.resetToken;
        this.goToStep('password');
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as PasswordResetError | null;
        this.errorMessage = body?.code === 'INVALID_CODE' ? 'รหัสยืนยันไม่ถูกต้อง'
          : body?.code === 'CODE_EXPIRED' ? 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่'
          : body?.code === 'CODE_LOCKED' ? body.message
          : genericError(err);
        this.otpInvalid = true;
        this.otp?.clear();
        this.otpValue = '';
        setTimeout(() => this.otp?.focus(0));
      }
    });
  }

  resendCode(): void {
    if (this.resendCooldown > 0 || this.resending) return;
    this.resending = true;
    this.errorMessage = '';
    this.infoMessage = '';
    this.passwordReset.forgotPassword(this.email).pipe(finalize(() => (this.resending = false))).subscribe({
      next: res => {
        this.infoMessage = 'ส่งรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้อีก';
        this.otpInvalid = false;
        this.otp?.clear();
        this.otpValue = '';
        this.otp?.focus(0);
        this.startCooldown(res.resendAfterSeconds);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 429) {
          this.startCooldown(retryAfter(err));
          this.errorMessage = err.error?.message || 'ขอรหัสบ่อยเกินไป กรุณาลองใหม่ภายหลัง';
          return;
        }
        this.errorMessage = genericError(err);
      }
    });
  }

  // ===== ขั้นที่ 3 =====

  passwordError(name: 'newPassword' | 'confirmPassword'): string | null {
    if (!this.submitted) return null;
    const control = this.passwordForm.controls[name];
    if (name === 'confirmPassword') {
      if (!control.value) return 'กรุณายืนยันรหัสผ่าน';
      return this.passwordForm.hasError('mismatch') ? 'รหัสผ่านไม่ตรงกัน' : null;
    }
    return control.getError('same') ?? control.getError('message') ?? null;
  }

  submitPassword(): void {
    if (this.loading) return;
    this.submitted = true;
    this.errorMessage = '';
    if (this.passwordError('newPassword')) {
      this.newPasswordInput?.nativeElement.focus();
      return;
    }
    if (this.passwordError('confirmPassword')) {
      this.confirmPasswordInput?.nativeElement.focus();
      return;
    }

    this.loading = true;
    this.passwordReset.resetPassword(this.resetToken, this.passwordForm.controls.newPassword.value)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: res => this.authModal.switchTo('login', { username: res.username, notice: RESET_SUCCESS_NOTICE }),
        error: (err: HttpErrorResponse) => {
          const body = err.error as PasswordResetError | null;
          if (body?.code === 'SAME_PASSWORD') {
            // แสดงใต้ช่องรหัสผ่านใหม่ — หายเองเมื่อแก้ค่า (Angular ตรวจ validator ใหม่)
            const control = this.passwordForm.controls.newPassword;
            control.setErrors({ ...(control.errors ?? {}), same: body.message });
            this.newPasswordInput?.nativeElement.focus();
          } else if (body?.code === 'INVALID_RESET_TOKEN') {
            this.tokenExpired = true;
            this.errorMessage = body.message;
          } else {
            this.errorMessage = genericError(err);
          }
        }
      });
  }

  /** reset token หมดอายุ -> เริ่มใหม่ตั้งแต่ขั้นที่ 1 (เก็บอีเมลเดิมไว้ให้) */
  restart(): void {
    this.cooldownSub?.unsubscribe();
    this.resendCooldown = 0;
    this.resetToken = '';
    this.tokenExpired = false;
    this.passwordForm.reset();
    this.emailForm.controls.email.setValue(this.email);
    this.goToStep('email');
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  toggleConfirm(): void { this.showConfirm = !this.showConfirm; }

  // ===== ทั่วไป =====

  private goToCodeStep(email: string, resendAfterSeconds?: number): void {
    this.email = email;
    this.otpValue = '';
    this.otpInvalid = false;
    this.goToStep('code');
    this.startCooldown(resendAfterSeconds);
  }

  /** เปลี่ยนขั้น: ล้าง error/สถานะ submit (error ของขั้นใหม่ขึ้นหลังกดปุ่มเท่านั้น) แล้ว focus ช่องแรกของขั้นนั้น */
  private goToStep(step: ForgotStep): void {
    this.step = step;
    this.submitted = false;
    this.errorMessage = '';
    this.infoMessage = '';
    // รอให้ Angular render ขั้นใหม่เสร็จก่อน (setTimeout เฉย ๆ บางครั้งมาก่อน render -> focus ไม่ติด)
    afterNextRender(() => {
      if (step === 'email') this.emailInput?.nativeElement.focus();
      if (step === 'code') this.otp?.focus(0);
      if (step === 'password') this.newPasswordInput?.nativeElement.focus();
    }, { injector: this.injector });
  }

  private startCooldown(seconds = DEFAULT_RESEND_SECONDS): void {
    this.cooldownSub?.unsubscribe();
    this.resendCooldown = Math.max(0, Math.ceil(seconds));
    if (!this.resendCooldown) return;
    this.cooldownSub = timer(1000, 1000).subscribe(() => {
      this.resendCooldown = Math.max(0, this.resendCooldown - 1);
      if (!this.resendCooldown) this.cooldownSub?.unsubscribe();
    });
  }
}

function retryAfter(err: HttpErrorResponse): number {
  const seconds = Number(err.headers?.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RESEND_SECONDS;
}

function genericError(err: HttpErrorResponse): string {
  return err.status === 0 ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง' : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}
