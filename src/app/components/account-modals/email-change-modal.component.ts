import { Component, ElementRef, Injector, OnDestroy, ViewChild, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AccountError, AccountService } from '../../services/account/account.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';
import { OtpInputComponent } from '../otp-input/otp-input.component';
import { StepperComponent } from '../stepper/stepper.component';
import { PasswordInputComponent } from '../password-input/password-input.component';
import { emailValidator } from '../../validators/auth.validators';
import { ILLUSTRATIONS } from '../../config/illustrations';
import { ResendCountdown, codeErrorMessage, genericError, retryAfterSeconds } from './resend-countdown';

/** 0 = ยืนยันตัวตนด้วยรหัสผ่าน, 1 = อีเมลใหม่, 2 = รหัสยืนยัน, 3 = เสร็จสิ้น */
export type EmailChangeStep = 0 | 1 | 2 | 3;

/**
 * popup "แก้ไขอีเมล" (เปิดจากปุ่ม "แก้ไข" ของ Email ในหน้าโปรไฟล์) — render ใน auth-modal-host
 * ปิดกลางทาง = component ถูก destroy -> เปิดใหม่เริ่มที่ขั้นยืนยันตัวตนเสมอ
 */
@Component({
  selector: 'app-email-change-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, OtpInputComponent, StepperComponent, PasswordInputComponent],
  templateUrl: './email-change-modal.component.html',
  styleUrl: './account-modal.css'
})
export class EmailChangeModalComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly account = inject(AccountService);
  private readonly authModal = inject(AuthModalService);
  private readonly profiles = inject(UserProfileService);
  private readonly injector = inject(Injector);

  readonly illustrations = ILLUSTRATIONS;
  readonly stepNames = ['อีเมลใหม่', 'รหัสยืนยัน', 'เสร็จสิ้น'];

  step: EmailChangeStep = 0;
  loading = false;
  submitted = false;
  errorMessage = '';
  infoMessage = '';

  /** token จากขั้นยืนยันรหัสผ่าน (อายุสั้น ใช้ได้เฉพาะงานแก้ไขอีเมล) */
  private actionToken = '';
  /** อีเมลที่ขอรหัสไปจริง */
  sentTo = '';

  otpInvalid = false;
  otpValue = '';
  resending = false;
  readonly countdown = new ResendCountdown();

  readonly passwordForm = this.fb.nonNullable.group({ password: ['', Validators.required] });
  readonly emailForm = this.fb.nonNullable.group({ email: ['', emailValidator] });

  @ViewChild(OtpInputComponent) private otp?: OtpInputComponent;
  @ViewChild(PasswordInputComponent) private passwordInput?: PasswordInputComponent;
  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('doneButton') private doneButton?: ElementRef<HTMLButtonElement>;

  ngOnDestroy(): void {
    this.countdown.stop();
  }

  /** ตำแหน่งของ stepper (ขั้น 1-3 -> index 0-2) */
  get stepperIndex(): number {
    return this.step - 1;
  }

  // ===== ขั้น 0: ยืนยันตัวตน =====

  get passwordError(): string | null {
    if (!this.submitted) return null;
    if (this.errorMessage) return this.errorMessage;
    return this.passwordForm.controls.password.value ? null : 'กรุณากรอกรหัสผ่าน';
  }

  submitPassword(): void {
    if (this.loading) return;
    this.submitted = true;
    this.errorMessage = '';
    if (this.passwordForm.invalid) {
      this.passwordInput?.focus();
      return;
    }
    this.loading = true;
    this.account.confirmPassword(this.passwordForm.controls.password.value)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: res => {
          this.actionToken = res.token;
          this.passwordForm.reset();
          this.goToStep(1);
        },
        error: (err: HttpErrorResponse) => {
          const body = err.error as AccountError | null;
          if (body?.code === 'WRONG_PASSWORD') {
            this.errorMessage = body.attemptsLeft !== undefined && body.attemptsLeft <= 2
              ? `รหัสผ่านไม่ถูกต้อง (เหลืออีก ${body.attemptsLeft} ครั้ง)`
              : 'รหัสผ่านไม่ถูกต้อง';
          } else if (err.status === 429) {
            this.errorMessage = body?.message || 'ใส่รหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง';
          } else {
            this.errorMessage = genericError(err);
          }
          this.passwordInput?.focus();
        }
      });
  }

  /** "ลืมรหัสผ่าน?" -> สลับไป popup ลืมรหัสผ่าน (ปิดอันนี้ในตัว ไม่มี popup ซ้อน) */
  onForgot(): void {
    this.authModal.switchTo('forgot');
  }

  /** บัญชีที่สมัครด้วย Google และยังไม่ได้ตั้งรหัสผ่าน — ยืนยันตัวตนด้วยรหัสผ่านไม่ได้ ต้องตั้งรหัสผ่านก่อน */
  get noPassword(): boolean {
    return this.profiles.currentUser?.hasPassword === false;
  }

  onSetPassword(): void {
    this.authModal.switchTo('password-change');
  }

  // ===== ขั้น 1: อีเมลใหม่ =====

  get emailError(): string | null {
    if (!this.submitted) return null;
    return this.emailForm.controls.email.getError('message') ?? (this.errorMessage || null);
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
    if (email.toLowerCase() === this.profiles.currentUser?.email?.toLowerCase()) {
      this.errorMessage = 'อีเมลนี้เป็นอีเมลปัจจุบันของคุณ';
      this.emailInput?.nativeElement.focus();
      return;
    }
    this.loading = true;
    this.account.requestEmailCode(this.actionToken, email).pipe(finalize(() => (this.loading = false))).subscribe({
      next: res => this.goToCodeStep(res.sentTo || email, res.resendAfterSeconds),
      error: (err: HttpErrorResponse) => {
        const body = err.error as AccountError | null;
        if (err.status === 429 && this.sentTo === email) {
          // เพิ่งขอไปที่อีเมลเดิม: รหัสล่าสุดยังใช้ได้ -> กลับไปกรอกรหัสต่อ
          this.goToCodeStep(email, retryAfterSeconds(err));
          this.infoMessage = 'เพิ่งส่งรหัสไปแล้ว กรุณาใช้รหัสล่าสุดในอีเมล';
          return;
        }
        if (body?.code === 'INVALID_ACTION_TOKEN') {
          this.restartIdentity(body.message);
          return;
        }
        this.errorMessage = body?.code === 'SAME_EMAIL' ? 'อีเมลนี้เป็นอีเมลปัจจุบันของคุณ'
          : body?.code === 'EMAIL_TAKEN' ? 'อีเมลนี้ถูกใช้แล้ว'
          : genericError(err);
        this.emailInput?.nativeElement.focus();
      }
    });
  }

  onCancel(): void {
    this.authModal.close();
  }

  // ===== ขั้น 2: รหัสยืนยัน =====

  /** "← ย้อนกลับ" -> ขั้น 1 โดยเก็บอีเมลที่กรอกไว้ */
  back(): void {
    this.otpValue = '';
    this.otpInvalid = false;
    this.emailForm.controls.email.setValue(this.sentTo);
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
    this.account.confirmEmailChange(this.actionToken, this.otpValue).pipe(finalize(() => (this.loading = false))).subscribe({
      next: res => {
        this.countdown.stop();
        this.profiles.setEmail(res.email);
        this.goToStep(3);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as AccountError | null;
        if (body?.code === 'INVALID_ACTION_TOKEN') {
          this.restartIdentity(body.message);
          return;
        }
        if (body?.code === 'EMAIL_TAKEN') {
          // มีคนใช้อีเมลนี้ไประหว่างรอ -> กลับไปกรอกอีเมลใหม่
          this.back();
          this.submitted = true;
          this.errorMessage = 'อีเมลนี้ถูกใช้แล้ว';
          return;
        }
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
    this.account.requestEmailCode(this.actionToken, this.sentTo).pipe(finalize(() => (this.resending = false))).subscribe({
      next: res => {
        this.infoMessage = 'ส่งรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้อีก';
        this.otpInvalid = false;
        this.otp?.clear();
        this.otpValue = '';
        this.otp?.focus(0);
        this.countdown.start(res.resendAfterSeconds);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as AccountError | null;
        if (body?.code === 'INVALID_ACTION_TOKEN') {
          this.restartIdentity(body.message);
          return;
        }
        if (err.status === 429) this.countdown.start(retryAfterSeconds(err));
        this.errorMessage = genericError(err);
      }
    });
  }

  // ===== ขั้น 3: เสร็จสิ้น =====

  finish(): void {
    this.authModal.close();
  }

  // ===== ทั่วไป =====

  private goToCodeStep(email: string, resendAfterSeconds?: number): void {
    this.sentTo = email;
    this.otpValue = '';
    this.otpInvalid = false;
    this.goToStep(2);
    this.countdown.start(resendAfterSeconds);
  }

  /** หมดเวลายืนยันตัวตน -> กลับขั้น 0 พร้อมข้อความ */
  private restartIdentity(message: string): void {
    this.countdown.stop();
    this.actionToken = '';
    this.sentTo = '';
    this.goToStep(0);
    this.submitted = true;
    this.errorMessage = message;
  }

  private goToStep(step: EmailChangeStep): void {
    this.step = step;
    this.submitted = false;
    this.errorMessage = '';
    this.infoMessage = '';
    afterNextRender(() => {
      if (step === 0) this.passwordInput?.focus();
      if (step === 1) this.emailInput?.nativeElement.focus();
      if (step === 2) this.otp?.focus(0);
      if (step === 3) this.doneButton?.nativeElement.focus();
    }, { injector: this.injector });
  }
}
