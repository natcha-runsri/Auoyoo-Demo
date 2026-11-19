import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import {
  BehaviorSubject, Observable, catchError, distinctUntilChanged, finalize, map, of, shareReplay, tap, throwError, timeout
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
  token: string;
  username: string;
  fullName: string | null;
  /** เข้าสู่ระบบด้วย Google แล้วเพิ่งผูกเข้าบัญชีเดิม (backend ล้างรหัสผ่านเดิมแล้ว) — มีเฉพาะครั้งนั้น */
  googleLinked?: boolean;
}

export interface AuthUser {
  username: string;
  fullName: string | null;
}

/** เรียก /refresh ล่วงหน้าก่อน access token หมดอายุเท่านี้ (ms) — กัน request ที่ไม่บังคับ login หลุดไปเป็น guest */
const REFRESH_BEFORE_EXPIRY_MS = 60_000;
/** ตอนเปิดเว็บถ้า backend ไม่ตอบภายในเวลานี้ ให้แสดงหน้าเว็บแบบยังไม่ login ไปก่อน ไม่ค้างหน้าขาว */
const RESTORE_TIMEOUT_MS = 5_000;
const CHANNEL_NAME = 'auoyoo-auth';

/**
 * สถานะการเข้าสู่ระบบของทั้งแอป (แหล่งความจริงเดียว — ทุก component อ่านผ่าน user$/loggedIn$ หรือ isLoggedIn())
 *
 * - access token (JWT อายุ 15 นาที) เก็บใน memory เท่านั้น ไม่ลง localStorage/sessionStorage (กัน XSS ขโมย token)
 * - refresh token อยู่ใน HttpOnly cookie ที่ backend ตั้งให้ JS อ่านไม่ได้ — ติ๊ก Remember me = cookie อายุ 30 วัน,
 *   ไม่ติ๊ก = session cookie หายเมื่อปิดเบราว์เซอร์
 * - เปิดเว็บ/รีเฟรชหน้า -> APP_INITIALIZER เรียก restoreSession() -> /refresh ถ้า cookie ยังอยู่ก็ได้ access token ใหม่
 * - ไม่เก็บรหัสผ่านไว้ที่ไหนเลย
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  private accessToken: string | null = null;
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(null);
  readonly user$: Observable<AuthUser | null> = this.userSubject.asObservable();
  readonly loggedIn$: Observable<boolean> = this.user$.pipe(map(user => !!user), distinctUntilChanged());

  private refreshInFlight$: Observable<string> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  // sync ข้ามแท็บ: logout แท็บหนึ่ง -> แท็บอื่นออกด้วย, login แท็บหนึ่ง -> แท็บอื่นขอ token จาก cookie เดียวกัน
  private readonly channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

  constructor() {
    clearLegacyStorage();
    this.channel?.addEventListener('message', event => this.zone.run(() => this.onOtherTabMessage(event.data)));
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
    this.channel?.close();
  }

  login(username: string, password: string, rememberMe = false): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { username, password, rememberMe }, { withCredentials: true })
      .pipe(tap(res => {
        this.setSession(res);
        this.channel?.postMessage('login');
      }));
  }

  /**
   * เข้าสู่ระบบด้วย Google: ส่ง authorization code จาก popup ให้ backend แลกและตรวจ ID token กับ Google เอง
   * ได้ session แบบเดียวกับ login() (access token ใน memory + refresh cookie, rememberMe เหมือนกัน)
   * X-Requested-With: backend บังคับ header นี้กัน CSRF ตามแนวทางของ Google สำหรับ popup mode
   */
  loginWithGoogle(code: string, rememberMe = false): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/google`, { code, rememberMe },
      { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .pipe(tap(res => {
        this.setSession(res);
        this.channel?.postMessage('login');
      }));
  }

  /**
   * สมัครสำเร็จ = login ให้ทันที; rememberMe ทำงานเหมือน login() (true = cookie 30 วัน, false = session cookie)
   * ไม่ส่ง fullName — ฟอร์มสมัครไม่มีช่องนี้ backend จึงเก็บเป็น null
   */
  register(username: string, email: string, password: string, rememberMe = false): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, { username, email, password, rememberMe }, { withCredentials: true })
      .pipe(tap(res => {
        this.setSession(res);
        this.channel?.postMessage('login');
      }));
  }

  /** ใช้ตอนเปิดแอป (APP_INITIALIZER) — ไม่ error เสมอ: ไม่มี cookie/backend ล่ม = เริ่มแบบยังไม่ login */
  restoreSession(): Observable<void> {
    return this.refresh().pipe(
      timeout(RESTORE_TIMEOUT_MS),
      map(() => undefined),
      catchError(() => of(undefined))
    );
  }

  /**
   * ขอ access token ใหม่จาก refresh cookie — ถ้ามีคนเรียกอยู่แล้ว (หลาย request เจอ 401 พร้อมกัน) จะได้ผลจากการเรียกเดียวกัน
   * cookie ใช้ไม่ได้ (401) -> ล้างสถานะ login; error อื่น (เน็ตหลุด/backend ล่ม) ไม่ล้าง ให้ลองใหม่ได้
   */
  refresh(): Observable<string> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {}, { withCredentials: true }).pipe(
        tap(res => this.setSession(res)),
        map(res => res.token),
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.clearSession();
          }
          return throwError(() => err);
        }),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.refreshInFlight$;
  }

  /** ผู้ใช้กด "ออกจากระบบ": ล้างสถานะทันที แล้วให้ backend revoke refresh token + ลบ cookie */
  logout(): void {
    this.clearSession();
    this.http.post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => { /* ฝั่ง client ออกแล้ว — server ล้มก็ไม่ต้องแจ้งผู้ใช้ */ } });
    this.channel?.postMessage('logout');
    this.leaveProtectedRoute();
  }

  /**
   * ลบบัญชีสำเร็จ: ออกจากระบบโดยไม่เรียก /logout (backend ลบ refresh token ทุกเครื่องและลบ cookie ให้แล้ว)
   * แท็บอื่นของเบราว์เซอร์นี้ออกจากระบบตามด้วย
   */
  endSessionAfterAccountDeleted(): void {
    this.clearSession();
    this.channel?.postMessage('logout');
  }

  /** refresh ไม่ผ่าน (session หมดอายุ/ถูก revoke) -> บังคับออกจากระบบ ไม่ต้องเรียก /logout ซ้ำ */
  forceLogout(): void {
    this.clearSession();
    this.leaveProtectedRoute();
  }

  /** เปลี่ยนรหัสผ่านจากหน้าโปรไฟล์สำเร็จ: token เดิมใช้ไม่ได้แล้ว -> ใช้ access token ใหม่ที่ backend ส่งมา (เครื่องนี้ยังล็อกอิน) */
  applyNewSession(res: AuthResponse): void {
    this.setSession(res);
  }

  /** เปลี่ยน username สำเร็จ: อัปเดตชื่อในเมนู/ทุกที่ทันที (token ผูกกับ user id จึงไม่ต้องขอ token ใหม่) */
  renameUser(username: string): void {
    const current = this.userSubject.value;
    if (current && current.username !== username) {
      this.userSubject.next({ ...current, username });
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  isLoggedIn(): boolean {
    return !!this.userSubject.value;
  }

  getUsername(): string | null {
    return this.userSubject.value?.username ?? null;
  }

  private setSession(res: AuthResponse): void {
    this.accessToken = res.token;
    this.scheduleRefresh(res.token);
    const current = this.userSubject.value;
    if (current?.username !== res.username || current?.fullName !== res.fullName) {
      this.userSubject.next({ username: res.username, fullName: res.fullName ?? null });
    }
  }

  private clearSession(): void {
    this.accessToken = null;
    this.clearRefreshTimer();
    if (this.userSubject.value) {
      this.userSubject.next(null);
    }
  }

  private scheduleRefresh(token: string): void {
    this.clearRefreshTimer();
    const expiresAt = readJwtExpiry(token);
    if (!expiresAt) {
      return;
    }
    const delay = Math.max(expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS, 5_000);
    // นอก Angular zone: timer ที่รอนาน ๆ จะไม่ทำให้ app ไม่ "stable" (กระทบ testability/hydration)
    this.zone.runOutsideAngular(() => {
      this.refreshTimer = setTimeout(() => this.zone.run(() => this.refresh().subscribe({
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.leaveProtectedRoute();
          }
        }
      })), delay);
    });
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private onOtherTabMessage(message: unknown): void {
    if (message === 'logout' && this.isLoggedIn()) {
      this.forceLogout();
    } else if (message === 'login') {
      this.refresh().subscribe({ error: () => { /* cookie ไม่มีจริง — คงสถานะเดิม */ } });
    }
  }

  /** อยู่หน้าที่มี canActivate (เช่น /profile, /history) ตอนออกจากระบบ -> กลับหน้าหลัก */
  private leaveProtectedRoute(): void {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (route) {
      if (route.routeConfig?.canActivate?.length) {
        void this.router.navigate(['/']);
        return;
      }
      route = route.firstChild;
    }
  }
}

/** ระบบเดิมเก็บ JWT ใน local/sessionStorage — ลบทิ้งให้หมด ไม่ให้ token เก่าค้างในเครื่อง */
function clearLegacyStorage(): void {
  try {
    for (const store of [localStorage, sessionStorage]) {
      store.removeItem('token');
      store.removeItem('username');
    }
  } catch {
    // storage ถูกบล็อก (private mode บางเบราว์เซอร์) — ไม่มีอะไรให้ลบ
  }
}

/** อ่าน exp (ms) จาก payload ของ JWT โดยไม่ verify — ใช้แค่กะเวลาต่ออายุ การตรวจจริงอยู่ที่ backend */
function readJwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(payload)).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
