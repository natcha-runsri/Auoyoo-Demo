import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/authen/auth.service';
import { environment } from '../../environments/environment';

// endpoint สาธารณะที่ผู้ใช้ยังไม่ login (ลืมรหัสผ่าน/รีเซ็ตรหัสผ่าน) — ห้ามแนบ Authorization header
const PUBLIC_AUTH_ENDPOINTS = ['/api/auth/forgot-password', '/api/auth/verify-reset-code', '/api/auth/reset-password'];
// endpoint ของ AuthService เอง — เจอ 401 แล้วห้ามวน refresh (login ผิดรหัส = 401 ปกติ, /refresh 401 = cookie หมดอายุ)
const NO_RETRY_ENDPOINTS = ['/api/auth/login', '/api/auth/google', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

/** request ที่ retry หลัง refresh ไปแล้ว — เจอ 401 อีกรอบให้ยอมแพ้ ไม่ refresh ซ้ำ */
const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

/**
 * ทุก request ไป backend ของเรา: แนบ access token (ถ้ามี) + withCredentials (ให้ browser ส่ง/รับ refresh cookie)
 * เจอ 401 ทั้งที่แนบ token ไป (token หมดอายุ) -> เรียก /refresh 1 ครั้งแล้วยิง request เดิมซ้ำด้วย token ใหม่
 * refresh ไม่ผ่านเพราะ session หมด (401) -> บังคับ logout
 * request ไปโดเมนอื่น (ถ้ามี) ไม่แตะเลย กัน token/cookie หลุดออกไปนอกระบบ
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiUrl)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const isPublicAuthEndpoint = PUBLIC_AUTH_ENDPOINTS.some(path => request.url.includes(path));
  const token = isPublicAuthEndpoint ? null : auth.getToken();

  return next(withAuth(request, token)).pipe(
    catchError((error: unknown) => {
      const canRetry = error instanceof HttpErrorResponse
        && error.status === 401
        && !!token
        && !request.context.get(RETRIED_AFTER_REFRESH)
        && !NO_RETRY_ENDPOINTS.some(path => request.url.includes(path));
      if (!canRetry) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          if (refreshError instanceof HttpErrorResponse && refreshError.status === 401) {
            auth.forceLogout();
          }
          return throwError(() => error);
        }),
        switchMap(newToken => next(withAuth(
          request.clone({ context: request.context.set(RETRIED_AFTER_REFRESH, true) }),
          newToken
        )))
      );
    })
  );
};

function withAuth(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return request.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {})
  });
}
