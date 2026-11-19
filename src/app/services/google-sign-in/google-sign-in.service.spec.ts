import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { GIS_SCRIPT_URL, GOOGLE_SCOPES, GoogleSignInError, GoogleSignInService } from './google-sign-in.service';
import { SiteConfigService } from '../site-config/site-config.service';

/** popup ของ Google แทนด้วย window.google ปลอม (ไม่โหลดสคริปต์จริง ไม่ต่อเน็ต) */
describe('GoogleSignInService', () => {
  type Config = { client_id: string; scope: string; ux_mode: string;
    callback: (r: { code?: string; error?: string }) => void; error_callback: (e: { type?: string }) => void };
  let service: GoogleSignInService;
  let siteConfig: SiteConfigService;
  let lastConfig: Config | undefined;
  /** สิ่งที่ "ผู้ใช้" ทำใน popup ตอน requestCode() */
  let popup: (config: Config) => void;
  const win = window as unknown as { google?: unknown };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GoogleSignInService);
    siteConfig = TestBed.inject(SiteConfigService);
    siteConfig.config.set({ siteUrl: 'http://localhost', contactEmail: '', googleClientId: 'client-123.apps.googleusercontent.com' });
    popup = config => config.callback({ code: 'auth-code' });
    lastConfig = undefined;
    win.google = {
      accounts: {
        oauth2: {
          initCodeClient: (config: Config) => {
            lastConfig = config;
            return { requestCode: () => popup(config) };
          }
        }
      }
    };
  });

  afterEach(() => {
    delete win.google;
    document.querySelectorAll(`script[src="${GIS_SCRIPT_URL}"]`).forEach(s => s.remove());
  });

  it('ไม่มี Client ID จาก backend -> ปิดปุ่ม และ requestCode ไม่เปิด popup', async () => {
    siteConfig.config.set({ siteUrl: 'http://localhost', contactEmail: '', googleClientId: '' });
    expect(service.enabled).toBeFalse();
    await expectAsync(service.requestCode()).toBeRejectedWith(new GoogleSignInError('unavailable'));
    expect(lastConfig).toBeUndefined();
  });

  it('เปิด popup แบบ authorization code ขอแค่ openid email profile ด้วย Client ID จาก backend -> ได้ code', async () => {
    await expectAsync(service.requestCode()).toBeResolvedTo('auth-code');
    expect(lastConfig?.client_id).toBe('client-123.apps.googleusercontent.com');
    expect(lastConfig?.scope).toBe(GOOGLE_SCOPES);
    expect(GOOGLE_SCOPES).toBe('openid email profile');
    expect(lastConfig?.ux_mode).toBe('popup');
  });

  it('ผู้ใช้ปิด popup หรือกดปฏิเสธ -> cancelled', async () => {
    popup = config => config.error_callback({ type: 'popup_closed' });
    await expectAsync(service.requestCode()).toBeRejectedWith(new GoogleSignInError('cancelled'));

    popup = config => config.callback({ error: 'access_denied' });
    await expectAsync(service.requestCode()).toBeRejectedWith(new GoogleSignInError('cancelled'));
  });

  it('เบราว์เซอร์บล็อก popup -> popup_blocked', async () => {
    popup = config => config.error_callback({ type: 'popup_failed_to_open' });
    const error = await service.requestCode().catch((e: GoogleSignInError) => e);
    expect((error as GoogleSignInError).kind).toBe('popup_blocked');
  });

  it('ยังไม่มีสคริปต์ -> โหลดสคริปต์ทางการของ Google ครั้งเดียว; โหลดไม่ได้ -> unavailable', async () => {
    delete win.google;
    // ไม่ใส่ <script> ลงหน้าจริง (ไม่ต่อเน็ต) — เก็บไว้แล้วแกล้งให้โหลดไม่สำเร็จเอง
    const appended: HTMLScriptElement[] = [];
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(node: T) => {
      appended.push(node as unknown as HTMLScriptElement);
      return node;
    });
    service.preload();
    service.preload();
    expect(appended.length).toBe(1);
    expect(appended[0].src).toBe(GIS_SCRIPT_URL);

    const pending = service.requestCode();
    appended[0].onerror?.(new Event('error'));
    await expectAsync(pending).toBeRejectedWith(new GoogleSignInError('unavailable'));
  });
});
