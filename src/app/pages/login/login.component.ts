import { Component, ElementRef, EventEmitter, Injector, OnInit, Output, ViewChild, afterNextRender, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize, from, switchMap } from 'rxjs';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { GoogleSignInError, GoogleSignInErrorKind, GoogleSignInService } from '../../services/google-sign-in/google-sign-in.service';

/** ห้ามว่าง และห้ามเป็นช่องว่างล้วน (Validators.required ปล่อย "   " ผ่าน) */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { required: true };
}

export const LOGIN_FAILED_MESSAGE = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

/** ข้อความเมื่อเข้าสู่ระบบด้วย Google ไม่สำเร็จ (ฝั่งหน้าเว็บ) — error จาก backend ใช้ message ที่ backend ส่งมา */
export const GOOGLE_MESSAGES: Record<GoogleSignInErrorKind | 'network', string> = {
  cancelled: 'ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว',
  popup_blocked: 'เบราว์เซอร์บล็อกหน้าต่างของ Google กรุณาอนุญาตป๊อปอัปแล้วลองใหม่อีกครั้ง',
  unavailable: 'โหลดบริการของ Google ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง',
  failed: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  network: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
};

/** popup ของ Google ล้มเหลว/ถูกยกเลิก -> ข้อความของเรา; backend ปฏิเสธ -> ข้อความภาษาไทยที่ backend ส่งมา (เช่น อีเมลยังไม่ยืนยัน) */
function googleErrorMessage(err: unknown): string {
  if (err instanceof GoogleSignInError) {
    return GOOGLE_MESSAGES[err.kind];
  }
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return GOOGLE_MESSAGES.network;
    }
    const message = (err.error as { message?: unknown } | null)?.message;
    return typeof message === 'string' && message ? message : GOOGLE_MESSAGES.failed;
  }
  return GOOGLE_MESSAGES.failed;
}

/**
 * เนื้อหาฟอร์ม Login (Reactive Forms) — render อยู่ใน auth-modal-host เสมอ (ดู AuthModalHostComponent)
 * ไม่มี overlay/ปุ่มปิดของตัวเอง, ไม่ navigate เปลี่ยนหน้าเวลาสลับไป Register/Forgot Password
 * แต่เรียก AuthModalService.switchTo() ตรง ๆ (host เดียวจัดการ modal ทั้งหมด กัน modal ซ้อนกัน)
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authModal = inject(AuthModalService);
  private readonly googleSignIn = inject(GoogleSignInService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  // หมายเหตุจงใจ: ช่อง Login ตรวจแค่ "ห้ามว่าง" เท่านั้น ไม่บังคับ pattern/ความยาวรหัสผ่านแบบ Register
  // เพราะ user เดิมที่สมัครไว้ก่อนมีกฎรหัสผ่านใหม่ต้องยังล็อกอินได้ (Register ค่อยบังคับกฎเต็มตอนสร้างรหัสใหม่)
  readonly form = this.fb.nonNullable.group({
    username: ['', notBlank],
    password: ['', Validators.required],
    rememberMe: [false]
  });

  errorMessage = '';
  loading = false;
  submitted = false;
  showPassword = false;
  /** มี username เติมมาให้ (จากฟอร์มสมัคร/หลังตั้งรหัสผ่านใหม่) -> modal host จะ focus ช่อง Password แทน Username */
  prefilled = false;
  /** ข้อความสีเขียวด้านบนฟอร์ม เช่น "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ" */
  notice = '';
  /** เข้าสู่ระบบด้วย Google: กำลังรอ popup/backend และข้อความเมื่อไม่สำเร็จ */
  googleLoading = false;
  googleError = '';
  /** เพิ่งผูก Google เข้าบัญชีเดิม (รหัสผ่านเดิมถูกล้าง) -> แสดงข้อความแจ้งแทนฟอร์ม แล้วค่อยปิด modal */
  googleLinkedNotice = false;

  @Output() loginSuccess = new EventEmitter<void>();

  @ViewChild('usernameInput') private usernameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') private passwordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('linkedOk') private linkedOk?: ElementRef<HTMLButtonElement>;

  ngOnInit(): void {
    // มาจาก "Back to Login" ของฟอร์มสมัคร หรือหลังตั้งรหัสผ่านใหม่สำเร็จ -> เติม username และข้อความแจ้งให้
    const prefill = this.authModal.consumeLoginPrefill();
    if (prefill?.username) {
      this.form.controls.username.setValue(prefill.username);
      this.prefilled = true;
    }
    this.notice = prefill?.notice ?? '';
    // โหลดสคริปต์ของ Google ไว้ก่อน — กดปุ่มแล้ว popup เปิดทันที (เปิดช้าเกินไปหลังคลิก เบราว์เซอร์จะบล็อก popup)
    this.googleSignIn.preload();
  }

  get googleEnabled(): boolean {
    return this.googleSignIn.enabled;
  }

  /**
   * เปิด popup ของ Google -> ส่ง code ให้ backend ตรวจ -> สำเร็จ = ปิด modal อยู่หน้าเดิม (เหมือน login ปกติ)
   * Remember me ในฟอร์มมีผลเหมือนกัน
   */
  onGoogle(): void {
    if (this.googleLoading || this.loading) {
      return;
    }
    this.googleLoading = true;
    this.googleError = this.errorMessage = this.notice = '';
    const rememberMe = this.form.controls.rememberMe.value;

    from(this.googleSignIn.requestCode())
      .pipe(
        switchMap(code => this.authService.loginWithGoogle(code, rememberMe)),
        finalize(() => (this.googleLoading = false))
      )
      .subscribe({
        next: res => {
          if (res.googleLinked) {
            this.googleLinkedNotice = true;
            // ฟอร์ม (และปุ่มที่เพิ่งกด) ถูกถอดออก -> ย้ายโฟกัสไปปุ่ม "ตกลง" หลังข้อความแจ้ง render แล้ว
            afterNextRender(() => this.linkedOk?.nativeElement.focus(), { injector: this.injector });
          } else {
            this.loginSuccess.emit();
          }
        },
        error: (err: unknown) => (this.googleError = googleErrorMessage(err))
      });
  }

  /** ลิงก์นโยบายความเป็นส่วนตัว: ปิด modal แล้วให้ routerLink พาไป /privacy */
  openPrivacy(): void {
    this.authModal.close();
  }

  closeLinkedNotice(): void {
    this.loginSuccess.emit();
  }

  /** ไปตั้งรหัสผ่านใหม่ที่หน้าโปรไฟล์ (ขั้นตอนเปลี่ยนรหัสผ่านเดิม ยืนยันทางอีเมล) */
  goSetPassword(): void {
    this.loginSuccess.emit();
    void this.router.navigate(['/profile']);
  }

  // error ขึ้นหลังกด Login เท่านั้น (เปิด popup/คลิก/Tab ผ่านช่องไม่แดง) — หลังจากนั้นแก้ช่องไหนถูกแล้ว error ช่องนั้นหายทันที
  showError(name: 'username' | 'password'): boolean {
    return this.submitted && this.form.controls[name].invalid;
  }

  fieldError(name: 'username' | 'password'): string {
    return name === 'username' ? 'กรุณากรอกชื่อผู้ใช้' : 'กรุณากรอกรหัสผ่าน';
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /** ngSubmit — ทั้งคลิกปุ่ม Login และกด Enter ในช่องใดก็ได้ */
  onLogin(): void {
    if (this.loading) {
      return; // กันกดซ้ำ/Enter รัว ๆ ระหว่างรอ API
    }
    this.submitted = true;
    this.errorMessage = '';
    this.notice = '';

    if (this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }

    const { username, password, rememberMe } = this.form.getRawValue();
    this.loading = true;

    this.authService.login(username.trim(), password, rememberMe)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => this.loginSuccess.emit(),
        error: (err: HttpErrorResponse) => {
          this.errorMessage = err.status === 401
            ? LOGIN_FAILED_MESSAGE
            : err.status === 0
              ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
              : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
          // คงชื่อผู้ใช้ไว้ ล้างเฉพาะรหัสผ่าน แล้วให้พิมพ์ใหม่ได้ทันที
          if (err.status === 401) {
            this.form.controls.password.reset('');
            this.submitted = false;
            setTimeout(() => this.passwordInput?.nativeElement.focus());
          }
        }
      });
  }

  /** พิมพ์แก้แล้วซ่อนข้อความ error จากเซิร์ฟเวอร์ (ไม่ค้างแดงทั้งที่กำลังแก้อยู่) */
  clearServerError(): void {
    this.errorMessage = '';
  }

  // TODO(sign-up): ปัจจุบันสลับไปฟอร์มสมัครสมาชิกเดิมใน modal เดียวกัน — ปรับ flow ได้ที่นี่
  onSignUp(): void {
    this.resetForm();
    this.authModal.switchTo('register');
  }

  // TODO(forgot-password): ปัจจุบันสลับไปฟอร์มลืมรหัสผ่านเดิมใน modal เดียวกัน — ปรับ flow ได้ที่นี่
  onForgotPassword(): void {
    this.resetForm();
    this.authModal.switchTo('forgot');
  }

  resetForm(): void {
    this.form.reset();
    this.errorMessage = this.googleError = '';
    this.submitted = this.showPassword = false;
  }

  private focusFirstInvalid(): void {
    const target = this.form.controls.username.invalid ? this.usernameInput : this.passwordInput;
    target?.nativeElement.focus();
  }
}
