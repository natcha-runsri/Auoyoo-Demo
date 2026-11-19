import { Injectable, NgZone, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SiteConfigService } from '../site-config/site-config.service';

/** สคริปต์ทางการของ Google Identity Services */
export const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
/** ขอแค่ข้อมูลระบุตัวตนพื้นฐาน */
export const GOOGLE_SCOPES = 'openid email profile';

/** cancelled = ผู้ใช้ปิด popup/กดปฏิเสธ, popup_blocked = เบราว์เซอร์บล็อก popup, unavailable = โหลดสคริปต์ไม่ได้ */
export type GoogleSignInErrorKind = 'cancelled' | 'popup_blocked' | 'unavailable' | 'failed';

export class GoogleSignInError extends Error {
  constructor(readonly kind: GoogleSignInErrorKind) {
    super(`Google sign-in ${kind}`);
  }
}

// ชนิดข้อมูลเฉพาะส่วนของ GIS ที่ใช้ (google.accounts.oauth2.initCodeClient แบบ popup)
interface CodeResponse { code?: string; error?: string }
interface NonOAuthError { type?: string }
interface CodeClient { requestCode(): void }
interface CodeClientConfig {
  client_id: string;
  scope: string;
  ux_mode: 'popup';
  callback: (response: CodeResponse) => void;
  error_callback: (error: NonOAuthError) => void;
}
interface GoogleGlobal { accounts?: { oauth2?: { initCodeClient(config: CodeClientConfig): CodeClient } } }

/**
 * เข้าสู่ระบบด้วย Google ฝั่งหน้าเว็บ: เปิด popup ของ Google แล้วรับ authorization code กลับมา
 * (ไม่มีข้อมูลผู้ใช้ในหน้าเว็บเลย — backend เอา code ไปแลกและตรวจ ID token กับ Google เอง ดู AuthService.loginWithGoogle)
 * Client ID มาจาก /api/site-config (ว่าง = ปิดปุ่ม) — ไม่ฝังในโค้ด
 * โหลดสคริปต์ GIS ครั้งแรกที่ต้องใช้ (preload ตอนเปิดฟอร์ม login เพื่อให้ popup เปิดทันทีที่กดปุ่ม ไม่โดนบล็อก)
 */
@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly siteConfig = inject(SiteConfigService);
  private scriptLoad?: Promise<GoogleGlobal>;

  get clientId(): string {
    return this.siteConfig.config().googleClientId;
  }

  get enabled(): boolean {
    return !!this.clientId;
  }

  /** โหลดสคริปต์ล่วงหน้า (ไม่ error — ถ้าล้มเหลวจะแจ้งตอนกดปุ่ม) */
  preload(): void {
    if (this.enabled) this.loadScript().catch(() => undefined);
  }

  /** เปิด popup ของ Google -> authorization code; ปิด popup/ปฏิเสธ -> GoogleSignInError('cancelled') */
  async requestCode(): Promise<string> {
    if (!this.enabled) throw new GoogleSignInError('unavailable');
    const google = await this.loadScript();
    const oauth2 = google.accounts?.oauth2;
    if (!oauth2) throw new GoogleSignInError('unavailable');

    return new Promise<string>((resolve, reject) => {
      const client = oauth2.initCodeClient({
        client_id: this.clientId,
        scope: GOOGLE_SCOPES,
        ux_mode: 'popup',
        callback: response => this.zone.run(() => {
          if (response.code) {
            resolve(response.code);
          } else {
            reject(new GoogleSignInError(response.error === 'access_denied' ? 'cancelled' : 'failed'));
          }
        }),
        error_callback: error => this.zone.run(() => reject(new GoogleSignInError(
          error.type === 'popup_closed' ? 'cancelled' : error.type === 'popup_failed_to_open' ? 'popup_blocked' : 'failed')))
      });
      client.requestCode();
    });
  }

  private loadScript(): Promise<GoogleGlobal> {
    const win = this.document.defaultView as (Window & { google?: GoogleGlobal }) | null;
    if (win?.google?.accounts?.oauth2) return Promise.resolve(win.google);
    this.scriptLoad ??= new Promise<GoogleGlobal>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.onload = () => win?.google ? resolve(win.google) : reject(new GoogleSignInError('unavailable'));
      script.onerror = () => {
        this.scriptLoad = undefined; // ลองโหลดใหม่ได้ตอนกดครั้งถัดไป (เน็ตกลับมาแล้ว)
        script.remove();
        reject(new GoogleSignInError('unavailable'));
      };
      this.document.head.appendChild(script);
    });
    return this.scriptLoad;
  }
}
