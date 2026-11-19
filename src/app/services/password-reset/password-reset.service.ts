import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ForgotPasswordResponse, ResetPasswordResponse, VerifyResetCodeResponse } from '../../models/password-reset.model';

/**
 * "ลืมรหัสผ่าน" แบบรหัสยืนยัน 6 หลัก — public endpoint ทั้งหมด ไม่ต้อง login
 *   1) forgotPassword  ส่งรหัสไปที่อีเมล (429 + Retry-After ถ้าขอถี่เกิน)
 *   2) verifyCode      รหัสถูก -> ได้ resetToken
 *   3) resetPassword   ตั้งรหัสผ่านใหม่ด้วย resetToken
 */
@Injectable({ providedIn: 'root' })
export class PasswordResetService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyCode(email: string, code: string): Observable<VerifyResetCodeResponse> {
    return this.http.post<VerifyResetCodeResponse>(`${this.apiUrl}/verify-reset-code`, { email, code });
  }

  resetPassword(resetToken: string, newPassword: string): Observable<ResetPasswordResponse> {
    return this.http.post<ResetPasswordResponse>(`${this.apiUrl}/reset-password`, { resetToken, newPassword });
  }
}
