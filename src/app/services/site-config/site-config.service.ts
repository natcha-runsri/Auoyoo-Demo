import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SiteConfig {
  /** URL จริงของเว็บ (ไม่มี / ปิดท้าย) — ใช้ทำ canonical / og:url / og:image */
  siteUrl: string;
  /** อีเมลติดต่อใน footer — ว่าง = ยังไม่ได้ตั้ง */
  contactEmail: string;
  /** OAuth Client ID ของปุ่มเข้าสู่ระบบด้วย Google (ไม่ใช่ความลับ) — ว่าง = ปิดปุ่ม */
  googleClientId: string;
}

const LOAD_TIMEOUT_MS = 4000;

/**
 * ค่าตั้งของเว็บ ดึงจาก backend (GET /api/site-config) ตอนเปิดเว็บ — แก้ที่ .env ของ backend ที่เดียว
 * (FRONTEND_URL, CONTACT_EMAIL, GOOGLE_CLIENT_ID) ไม่ต้อง build frontend ใหม่
 * backend ไม่ตอบ -> ใช้ URL ที่เปิดอยู่ตอนนี้แทน และไม่แสดงอีเมล
 */
@Injectable({ providedIn: 'root' })
export class SiteConfigService {
  private readonly http = inject(HttpClient);

  readonly config = signal<SiteConfig>({ siteUrl: currentOrigin(), contactEmail: '', googleClientId: '' });

  get siteUrl(): string {
    return this.config().siteUrl;
  }

  /** APP_INITIALIZER — ไม่ error เสมอ */
  load(): Observable<void> {
    return this.http.get<Partial<SiteConfig>>(`${environment.apiUrl}/site-config`).pipe(
      timeout(LOAD_TIMEOUT_MS),
      map(res => {
        this.config.set({
          siteUrl: stripTrailingSlashes(res.siteUrl || currentOrigin()),
          contactEmail: (res.contactEmail ?? '').trim(),
          googleClientId: (res.googleClientId ?? '').trim()
        });
      }),
      catchError(() => of(undefined))
    );
  }
}

function currentOrigin(): string {
  return typeof location !== 'undefined' ? location.origin : '';
}

/** ตัด "/" ท้าย URL (ไม่ใช้ regex /\/+$/ ซึ่งช้าแบบกำลังสองเมื่อเจอ "/" ยาว ๆ) */
function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}
