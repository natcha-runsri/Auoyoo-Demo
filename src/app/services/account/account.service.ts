import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, AuthService } from '../authen/auth.service';

/** ขั้นขอรหัส: ส่งไปที่อีเมลไหน + อายุรหัส + ต้องรอกี่วินาทีก่อนขอใหม่ */
export interface CodeSent {
  sentTo: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** token ของขั้นถัดไป (ยืนยันรหัสผ่านปัจจุบัน / ยืนยันรหัส 6 หลัก) */
export interface StepToken {
  token: string;
  expiresInSeconds: number;
}

/** error ของงานบัญชี { code, message, attemptsLeft? } */
export interface AccountError {
  code: string;
  message: string;
  attemptsLeft?: number;
}

/**
 * API งานบัญชีของผู้ที่ล็อกอินอยู่ (หน้าโปรไฟล์) — แต่ละงานมี endpoint ของตัวเอง รหัสใช้ข้ามงานไม่ได้
 *   แก้ไขอีเมล:   confirmPassword -> requestEmailCode -> confirmEmailChange
 *   เปลี่ยนรหัสผ่าน: requestPasswordCode -> verifyPasswordCode -> changePassword
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users/me`;

  confirmPassword(password: string): Observable<StepToken> {
    return this.http.post<StepToken>(`${this.baseUrl}/password-confirm`, { password });
  }

  requestEmailCode(token: string, newEmail: string): Observable<CodeSent> {
    return this.http.post<CodeSent>(`${this.baseUrl}/email/code`, { token, newEmail });
  }

  confirmEmailChange(token: string, code: string): Observable<{ email: string }> {
    return this.http.post<{ email: string }>(`${this.baseUrl}/email/confirm`, { token, code });
  }

  /** ลบบัญชี (บัญชีไม่มีรหัสผ่าน): ขอรหัสยืนยันทางอีเมล */
  requestDeleteCode(): Observable<CodeSent> {
    return this.http.post<CodeSent>(`${this.baseUrl}/delete/code`, {});
  }

  /** ลบบัญชีถาวร — confirmation ต้องเป็น "ลบบัญชี"; มีรหัสผ่านส่ง password ไม่มีส่ง code (รอไม่เกิน 30 วิ) */
  deleteAccount(body: { confirmation: string; password?: string; code?: string }): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/delete`, body, { withCredentials: true }).pipe(timeout(30_000));
  }

  requestPasswordCode(): Observable<CodeSent> {
    return this.http.post<CodeSent>(`${this.baseUrl}/password/code`, {});
  }

  verifyPasswordCode(code: string): Observable<StepToken> {
    return this.http.post<StepToken>(`${this.baseUrl}/password/verify`, { code });
  }

  /** สำเร็จ: backend ส่ง access token ใหม่ของเครื่องนี้มา (เครื่องอื่นหลุดทั้งหมด) -> ใช้ token ใหม่ทันที */
  changePassword(resetToken: string, newPassword: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/password`, { resetToken, newPassword })
      .pipe(tap(res => this.auth.applyNewSession(res)));
  }
}
