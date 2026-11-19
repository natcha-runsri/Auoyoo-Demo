import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../authen/auth.service';

export interface CurrentUser {
  username: string;
  email: string;
  avatarUrl: string | null;
  /** false = บัญชีที่สมัครด้วย Google และยังไม่ได้ตั้งรหัสผ่าน */
  hasPassword?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly baseUrl = `${environment.apiUrl}/users/me`;
  private readonly currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  get currentUser(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  loadCurrentUser(): void {
    if (!this.auth.isLoggedIn()) {
      this.clear();
      return;
    }
    this.http.get<CurrentUser>(this.baseUrl).pipe(
      tap(user => this.currentUserSubject.next(this.normalise(user))),
      catchError(() => {
        this.clear();
        return of(null);
      })
    ).subscribe();
  }

  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ avatarUrl: string }>(`${this.baseUrl}/avatar`, body).pipe(
      tap(response => {
        const user = this.currentUser;
        if (user) {
          this.currentUserSubject.next({ ...user, avatarUrl: this.toAbsoluteUrl(response.avatarUrl) });
        }
      })
    );
  }

  /** เปลี่ยน username (กฎเดียวกับสมัคร) — สำเร็จแล้วชื่อที่ navbar/เมนูผู้ใช้เปลี่ยนทันที */
  changeUsername(username: string): Observable<CurrentUser> {
    return this.http.patch<CurrentUser>(`${this.baseUrl}/username`, { username }).pipe(
      tap(user => {
        this.currentUserSubject.next(this.normalise(user));
        this.auth.renameUser(user.username);
      })
    );
  }

  /** เปลี่ยนอีเมลสำเร็จ (popup แก้ไขอีเมล) -> อัปเดตหน้าโปรไฟล์ทันที */
  setEmail(email: string): void {
    const user = this.currentUser;
    if (user) {
      this.currentUserSubject.next({ ...user, email });
    }
  }

  clear(): void {
    this.currentUserSubject.next(null);
  }

  toAbsoluteUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    // URL เต็ม หรือรูป preview ในเบราว์เซอร์ (blob:/data:) ใช้ตามเดิม
    if (/^(https?:\/\/|blob:|data:)/i.test(url)) return url;
    const backendUrl = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private normalise(user: CurrentUser): CurrentUser {
    return { ...user, avatarUrl: this.toAbsoluteUrl(user.avatarUrl) };
  }
}
