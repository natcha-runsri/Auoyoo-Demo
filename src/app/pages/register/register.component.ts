import { Component, ElementRef, EventEmitter, Output, QueryList, ViewChildren, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import {
  PASSWORD_RULES, emailValidator, matchFieldsValidator, passwordValidator, usernameValidator
} from '../../validators/auth.validators';

type FieldName = 'email' | 'username' | 'password' | 'confirmPassword';

/** ข้อความเมื่อ backend ตอบ 409 ว่าซ้ำ — แสดงใต้ช่องนั้นตรง ๆ */
export const TAKEN_MESSAGES: Record<'email' | 'username', string> = {
  email: 'อีเมลนี้ถูกใช้แล้ว',
  username: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว'
};

/**
 * เนื้อหาฟอร์ม Register (Reactive Forms) — render อยู่ใน auth-modal-host เสมอ เหมือน LoginComponent
 * ไม่มี overlay/ปุ่มปิดของตัวเอง, "Back to Login" เรียก AuthModalService.switchTo() ใน modal เดิม
 * สมัครสำเร็จ = backend login ให้เลย (ตั้ง refresh cookie ตาม Remember me) -> emit registerSuccess ให้ host ปิด popup
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authModal = inject(AuthModalService);

  readonly form = this.fb.nonNullable.group({
    email: ['', emailValidator],
    username: ['', usernameValidator],
    password: ['', passwordValidator],
    confirmPassword: [''],
    rememberMe: [false]
  }, { validators: matchFieldsValidator('password', 'confirmPassword') });

  readonly passwordRules = PASSWORD_RULES;
  readonly fieldOrder: FieldName[] = ['email', 'username', 'password', 'confirmPassword'];

  errorMessage = '';
  loading = false;
  submitted = false;
  showPassword = false;
  showConfirm = false;
  /** checklist กฎรหัสผ่านแสดงเฉพาะตอน focus ช่อง Password (กล่องลอย ไม่ดันช่องอื่น) */
  passwordFocused = false;

  @Output() registerSuccess = new EventEmitter<void>();

  @ViewChildren('field') private fields?: QueryList<ElementRef<HTMLInputElement>>;

  /**
   * error ขึ้นครั้งแรกหลังกด Register เท่านั้น (เปิด popup/คลิก/Tab ผ่านช่องไม่แดง)
   * หลังจากนั้นตรวจสด: แก้ช่องไหนถูกแล้ว error ช่องนั้นหายทันที (409 ซ้ำก็แสดงใต้ช่องผ่านทางนี้)
   */
  showError(name: FieldName): boolean {
    return this.submitted && !!this.fieldError(name);
  }

  fieldError(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (name === 'confirmPassword') {
      if (!control.value) return 'กรุณายืนยันรหัสผ่าน';
      return this.form.hasError('mismatch') ? 'รหัสผ่านไม่ตรงกัน' : null;
    }
    if (control.hasError('taken')) return control.getError('taken');
    return control.getError('message') ?? null;
  }

  /** ยังไม่พิมพ์ = ยังไม่ติ๊กข้อไหนเลย (กันข้อ "อักขระที่อนุญาต" ขึ้น ✓ ทั้งที่ช่องว่าง) */
  ruleMet(rule: (typeof PASSWORD_RULES)[number]): boolean {
    const password = this.form.controls.password.value;
    return !!password && rule.test(password);
  }

  /** ngSubmit — ทั้งคลิกปุ่ม Register และกด Enter ในช่องใดก็ได้ */
  onRegister(): void {
    if (this.loading) {
      return; // กันกดซ้ำระหว่างรอ API
    }
    this.submitted = true;
    this.errorMessage = '';

    if (this.firstInvalidField()) {
      this.focusField(this.firstInvalidField()!);
      return;
    }

    const { email, username, password, rememberMe } = this.form.getRawValue();
    const trimmedUsername = username.trim();
    this.loading = true;

    // ดีไซน์ไม่มีช่องชื่อเต็ม -> ไม่ส่ง fullName (backend เก็บเป็น null) ไม่เดาค่าแทนผู้ใช้
    this.authService.register(trimmedUsername, email.trim(), password, rememberMe)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => this.registerSuccess.emit(),
        error: (err: HttpErrorResponse) => this.handleError(err)
      });
  }

  onBackToLogin(): void {
    // พา username ที่กรอกไว้ไปเติมช่อง Username ของ login
    const username = this.form.controls.username.value;
    this.resetForm();
    this.authModal.switchTo('login', { username });
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  toggleConfirm(): void { this.showConfirm = !this.showConfirm; }

  clearServerError(): void {
    this.errorMessage = '';
  }

  resetForm(): void {
    this.form.reset();
    this.errorMessage = '';
    this.submitted = this.showPassword = this.showConfirm = this.passwordFocused = false;
  }

  private handleError(err: HttpErrorResponse): void {
    const field = err.error?.field;
    if (err.status === 409 && (field === 'email' || field === 'username')) {
      // ติด error ไว้ที่ช่องนั้น — หายเองเมื่อผู้ใช้แก้ค่า (Angular ตรวจ validator ใหม่) ข้อมูลที่กรอกไม่ถูกล้าง
      const control = this.form.controls[field as 'email' | 'username'];
      control.setErrors({ ...(control.errors ?? {}), taken: TAKEN_MESSAGES[field as 'email' | 'username'] });
      this.focusField(field);
      return;
    }
    this.errorMessage = err.status === 0
      ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
      : err.status === 400 && err.error?.message
        ? `ข้อมูลไม่ถูกต้อง: ${err.error.message}`
        : 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }

  private firstInvalidField(): FieldName | undefined {
    return this.fieldOrder.find(name => !!this.fieldError(name));
  }

  private focusField(name: FieldName): void {
    setTimeout(() => this.fields?.find(ref => ref.nativeElement.id === `register-${name}`)?.nativeElement.focus());
  }
}
