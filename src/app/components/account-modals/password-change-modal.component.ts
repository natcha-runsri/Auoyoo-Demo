import { Component, ElementRef, Injector, OnDestroy, ViewChild, ViewChildren, QueryList, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AccountError, AccountService } from '../../services/account/account.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';
import { OtpInputComponent } from '../otp-input/otp-input.component';
import { StepperComponent } from '../stepper/stepper.component';
import { PasswordInputComponent } from '../password-input/password-input.component';
import { matchFieldsValidator, passwordValidator } from '../../validators/auth.validators';
import { ILLUSTRATIONS } from '../../config/illustrations';
import { ResendCountdown, codeErrorMessage, genericError, retryAfterSeconds } from './resend-countdown';

/** 1 = ส่งรหัสไปอีเมลปัจจุบัน, 2 = รหัสยืนยัน, 3 = รหัสผ่านใหม่, 4 = สำเร็จ */
export type PasswordChangeStep = 1 | 2 | 3 | 4;

/**
 * popup "เปลี่ยนรหัสผ่าน" (เปิดจาก "Change Password" ในหน้าโปรไฟล์) — render ใน auth-modal-host
 * แยกจาก popup ลืมรหัสผ่านโดยสิ้นเชิง (endpoint/รหัสคนละงาน) ใช้ร่วมแค่ชิ้นส่วนย่อย
 * สำเร็จ: เครื่องนี้ได้ token ใหม่ ยังล็อกอินอยู่ เครื่องอื่นหลุดทั้งหมด
 */
@Component({
  selector: 'app-password-change-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, OtpInputComponent, StepperComponent, PasswordInputComponent],
  templateUrl: './password-change-modal.component.html',
  styleUrl: './account-modal.css'
})
export class PasswordChangeModalComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly account = inject(AccountService);
  private readonly authModal = inject(AuthModalService);
  private readonly profiles = inject(UserProfileService);
  private readonly injector = inject(Injector);

  readonly illustrations = ILLUSTRATIONS;
  readonly stepNames = ['อีเมล', 'รหัสยืนยัน', 'รหัสผ่านใหม่'];

  step: PasswordChangeStep = 1;
  loading = false;
  submitted = false;
  errorMessage = '';
  infoMessage = '';
  /** อีเมลที่ส่งรหัสไปจริง */
  sentTo = '';
  private resetToken = '';
  /** reset token หมดอายุ -> ต้องขอรหัสใหม่ */
  tokenExpired = false;

  otpInvalid = false;
  otpValue = '';
  resending = false;
  readonly countdown = new ResendCountdown();

  readonly passwordForm = this.fb.nonNullable.group({
    newPassword: ['', passwordValidator],
    confirmPassword: ['']
  }, { validators: matchFieldsValidator('newPassword', 'confirmPassword') });

  @ViewChild(OtpInputComponent) private otp?: OtpInputComponent;
  @ViewChildren(PasswordInputComponent) private passwordInputs?: QueryList<PasswordInputComponent>;
  @ViewChild('sendButton') private sendButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('doneButton') private doneButton?: ElementRef<HTMLButtonElement>;

  ngOnDestroy(): void {
    this.countdown.stop();
  }

  /** อีเมลปัจจุบันของผู้ใช้ (แสดงอย่างเดียว แก้ไม่ได้) */
  get email(): string {
    return this.profiles.currentUser?.email ?? '';
  }

  get stepperIndex(): number {
    return this.step - 1;
  }

  // ===== ขั้น 1: ส่งรหัส =====

  sendCode(): void {
    if (this.loading) return;
    this.submitted = true;
    this.errorMessage = '';
    this.loading = true;
    this.account.requestPasswordCode().pipe(finalize(() => (this.loading = false))).subscribe({
      next: res => this.goToCodeStep(res.sentTo, res.resendAfterSeconds),
      error: (err: HttpErrorResponse) => {
        if (err.status === 429 && this.sentTo) {
          // เพิ่งขอไป: รหัสล่าสุดยังใช้ได้ -> กลับไปกรอกรหัสต่อ
          this.goToCodeStep(this.sentTo, retryAfterSeconds(err));
          this.infoMessage = 'เพิ่งส่งรหัสไปแล้ว กรุณาใช้รหัสล่าสุดในอีเมล';
          return;
        }
        this.errorMessage = genericError(err);
      }
    });
  }

  onCancel(): void {
    this.authModal.close();
  }

  // ===== ขั้น 2: รหัสยืนยัน =====

  back(): void {
    this.otpValue = '';
    this.otpInvalid = false;
    this.goToStep(1);
  }

  onOtpChanged(value: string): void {
    this.otpValue = value;
    if (this.otpInvalid || this.errorMessage) {
      this.otpInvalid = false;
      this.errorMessage = '';
    }
  }

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
    this.account.verifyPasswordCode(this.otpValue).pipe(finalize(() => (this.loading = false))).subscribe({
      next: res => {
        this.resetToken = res.token;
        this.tokenExpired = false;
        this.countdown.stop();
        this.goToStep(3);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as AccountError | null;
        this.errorMessage = codeErrorMessage(body?.code, genericError(err));
        this.otpInvalid = true;
        this.otp?.clear();
        this.otpValue = '';
        this.otp?.focus(0);
      }
    });
  }

  resendCode(): void {
    if (this.countdown.seconds > 0 || this.resending) return;
    this.resending = true;
    this.errorMessage = '';
    this.infoMessage = '';
    this.account.requestPasswordCode().pipe(finalize(() => (this.resending = false))).subscribe({
      next: res => {
        this.infoMessage = 'ส่งรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้อีก';
        this.otpInvalid = false;
        this.otp?.clear();
        this.otpValue = '';
        this.otp?.focus(0);
        this.countdown.start(res.resendAfterSeconds);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 429) this.countdown.start(retryAfterSeconds(err));
        this.errorMessage = genericError(err);
      }
    });
  }

  // ===== ขั้น 3: รหัสผ่านใหม่ =====

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
      this.focusPassword(0);
      return;
    }
    if (this.passwordError('confirmPassword')) {
      this.focusPassword(1);
      return;
    }
    this.loading = true;
    this.account.changePassword(this.resetToken, this.passwordForm.controls.newPassword.value)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.resetToken = '';
          this.goToStep(4);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as AccountError | null;
          if (body?.code === 'SAME_PASSWORD') {
            const control = this.passwordForm.controls.newPassword;
            control.setErrors({ ...(control.errors ?? {}), same: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' });
            this.focusPassword(0);
          } else if (body?.code === 'INVALID_RESET_TOKEN') {
            this.tokenExpired = true;
            this.errorMessage = body.message;
          } else {
            this.errorMessage = genericError(err);
          }
        }
      });
  }

  /** reset token หมดอายุ -> เริ่มใหม่ที่ขั้นส่งรหัส */
  restart(): void {
    this.countdown.stop();
    this.resetToken = '';
    this.sentTo = '';
    this.tokenExpired = false;
    this.passwordForm.reset();
    this.goToStep(1);
  }

  // ===== ขั้น 4: สำเร็จ =====

  finish(): void {
    this.authModal.close();
  }

  // ===== ทั่วไป =====

  private focusPassword(index: number): void {
    this.passwordInputs?.get(index)?.focus();
  }

  private goToCodeStep(email: string, resendAfterSeconds?: number): void {
    this.sentTo = email || this.email;
    this.otpValue = '';
    this.otpInvalid = false;
    this.goToStep(2);
    this.countdown.start(resendAfterSeconds);
  }

  private goToStep(step: PasswordChangeStep): void {
    this.step = step;
    this.submitted = false;
    this.errorMessage = '';
    this.infoMessage = '';
    afterNextRender(() => {
      if (step === 1) this.sendButton?.nativeElement.focus();
      if (step === 2) this.otp?.focus(0);
      if (step === 3) this.focusPassword(0);
      if (step === 4) this.doneButton?.nativeElement.focus();
    }, { injector: this.injector });
  }
}
