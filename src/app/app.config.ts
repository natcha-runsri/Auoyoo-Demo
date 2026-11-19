import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/authen/auth.service';
import { SiteConfigService } from './services/site-config/site-config.service';
import { DEMO_INTERCEPTORS } from './demo/demo-mode';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // DEMO_INTERCEPTORS ว่างใน build ปกติ — configuration "demo" ใส่ตัวตอบ /api ด้วยข้อมูลจำลอง (ต้องอยู่หลัง authInterceptor)
    provideHttpClient(withInterceptors([authInterceptor, ...DEMO_INTERCEPTORS])),
    // (APP_INITIALIZER) เปิดเว็บ -> เรียก /refresh ด้วย refresh cookie ก่อนเริ่มแอป
    // ถ้ายังล็อกอินอยู่ (Remember me หรือ session เดิม) guard/navbar/รายการโปรด จะเห็นสถานะ login ตั้งแต่ render แรก
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // ค่าตั้งของเว็บจาก backend (URL จริงของเว็บ + อีเมลติดต่อ) — ใช้ใน footer และ SEO
    provideAppInitializer(() => inject(SiteConfigService).load())
  ]
};
