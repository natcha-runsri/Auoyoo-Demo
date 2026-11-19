/** ขั้นที่ 1: ตอบเหมือนกันเสมอไม่ว่าอีเมลจะมีบัญชีหรือไม่ */
export interface ForgotPasswordResponse {
  message: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** ขั้นที่ 2: reset token ชั่วคราวสำหรับขั้นที่ 3 (ไม่ส่งรหัส 6 หลักซ้ำ) */
export interface VerifyResetCodeResponse {
  resetToken: string;
  expiresInSeconds: number;
}

/** ขั้นที่ 3 */
export interface ResetPasswordResponse {
  message: string;
  username: string;
}

/** error body ของขั้น 2-3 (400) */
export type PasswordResetErrorCode = 'INVALID_CODE' | 'CODE_EXPIRED' | 'CODE_LOCKED' | 'INVALID_RESET_TOKEN' | 'SAME_PASSWORD';

export interface PasswordResetError {
  code: PasswordResetErrorCode;
  message: string;
  attemptsLeft?: number;
}
