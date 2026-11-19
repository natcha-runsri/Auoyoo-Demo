import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/**
 * กฎ username/email/password ของฟอร์มสมัครสมาชิก (Reactive Forms) — ต้องตรงกับฝั่ง backend เสมอ ดู:
 * backend/src/main/java/com/itproject/backend/dto/RegisterRequest.java
 * (ฟอร์ม Login ตรวจแค่ "ห้ามว่าง" ไม่ได้ใช้ไฟล์นี้ — user เก่าที่สมัครก่อนมีกฎใหม่ต้องยังล็อกอินได้)
 */

/** Username: a-z, A-Z, 0-9 เท่านั้น (ไม่รวม underscore) ยาว 3-50 ตัว (@Size(min=3, max=50) + @Pattern) */
export const USERNAME_PATTERN = /^[A-Za-z0-9]+$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;

/** Email: ยาวไม่เกิน 100 (คอลัมน์ users.email) — รูปแบบใช้ Validators.email ซึ่งหลวมเท่า @Email ของ backend */
export const EMAIL_MAX_LENGTH = 100;

/** อักขระพิเศษที่ยอมรับใน password */
const SPECIAL_CLASS = `[!@#$%\\^&*()_+\\-=\\[\\]{};':"\\\\|,.<>/?]`;
export const PASSWORD_SPECIAL_RE = new RegExp(SPECIAL_CLASS);
/** ทั้ง password ต้องประกอบด้วยตัวอักษร/ตัวเลข/อักขระพิเศษที่กำหนดเท่านั้น (ไม่มี unicode/เว้นวรรค) */
export const PASSWORD_ALLOWED_RE = new RegExp(`^[A-Za-z0-9${SPECIAL_CLASS.slice(1, -1)}]*$`);
export const PASSWORD_MIN_LENGTH = 9;
/** BCrypt รับได้แค่ 72 byte — อักขระที่อนุญาตเป็น ASCII ล้วน จึงเท่ากับ 72 ตัว */
export const PASSWORD_MAX_LENGTH = 72;

export interface PasswordRule {
  key: string;
  /** ข้อความสั้นใน checklist ตอน focus ช่อง Password */
  label: string;
  /** ข้อความ error บรรทัดเดียวใต้ช่อง เมื่อกด Register แล้วข้อนี้ยังไม่ผ่าน */
  error: string;
  test: (password: string) => boolean;
}

/** กฎรหัสผ่านทีละข้อ (เรียงตามลำดับที่จะแจ้ง error) — ใช้ทั้งตรวจและแสดงเป็น checklist ตอน focus */
export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: `${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} ตัวอักษร`,
    error: `รหัสผ่านต้องมี ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} ตัวอักษร`,
    test: p => p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH },
  { key: 'lower', label: 'ตัวพิมพ์เล็ก a-z', error: 'รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว', test: p => /[a-z]/.test(p) },
  { key: 'upper', label: 'ตัวพิมพ์ใหญ่ A-Z', error: 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว', test: p => /[A-Z]/.test(p) },
  { key: 'special', label: 'อักขระพิเศษ เช่น ! @ #', error: 'รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว',
    test: p => PASSWORD_SPECIAL_RE.test(p) },
  { key: 'allowed', label: 'ไม่มีเว้นวรรค/ภาษาไทย', error: 'รหัสผ่านห้ามมีเว้นวรรคหรือภาษาไทย',
    test: p => PASSWORD_ALLOWED_RE.test(p) }
];

export function getUsernameError(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'กรุณากรอกชื่อผู้ใช้';
  }
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return `ชื่อผู้ใช้ต้องมี ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} ตัวอักษร`;
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, A-Z และ 0-9';
  }
  return null;
}

export function getEmailError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'กรุณากรอกอีเมล';
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return `อีเมลต้องไม่เกิน ${EMAIL_MAX_LENGTH} ตัวอักษร`;
  }
  // Validators.email ทำงานกับ control — เรียกผ่าน object รูปทรงเดียวกันเพื่อใช้กฎเดียวกันกับ Angular
  return Validators.email({ value: trimmed } as AbstractControl) ? 'รูปแบบอีเมลไม่ถูกต้อง' : null;
}

/** คืนเฉพาะกฎที่ "ยังไม่ผ่าน" — ว่าง = ผ่านครบ */
export function failedPasswordRules(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter(rule => !rule.test(password));
}

/** ValidatorFn — error key = 'message' ถือข้อความภาษาไทยที่จะแสดงใต้ช่องเลย */
export const usernameValidator: ValidatorFn = control => messageError(getUsernameError(control.value ?? ''));
export const emailValidator: ValidatorFn = control => messageError(getEmailError(control.value ?? ''));
export const passwordValidator: ValidatorFn = control => {
  const value: string = control.value ?? '';
  if (!value) {
    return { message: 'กรุณากรอกรหัสผ่าน' };
  }
  // แจ้งทีละข้อ (ข้อแรกที่ยังไม่ผ่าน) ให้เป็นข้อความบรรทัดเดียว
  const failed = failedPasswordRules(value)[0];
  return failed ? { message: failed.error } : null;
};

/** validator ระดับ form group: confirmPassword ต้องตรงกับ password (ตรวจใหม่ทุกครั้งที่ช่องไหนเปลี่ยน) */
export function matchFieldsValidator(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const value = group.get(field)?.value;
    const confirm = group.get(confirmField)?.value;
    return confirm && value !== confirm ? { mismatch: true } : null;
  };
}

function messageError(message: string | null): ValidationErrors | null {
  return message ? { message } : null;
}
