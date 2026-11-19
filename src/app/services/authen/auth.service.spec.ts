import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Component({ standalone: true, template: '' })
class DummyPage {}

/** JWT ปลอม (ไม่มี signature จริง) ที่มี exp ตามต้องการ — AuthService อ่านแค่ exp ไว้กะเวลา refresh */
function fakeJwt(expSecondsFromNow = 900): string {
  const payload = btoa(JSON.stringify({ sub: 'tester', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
  return `header.${payload.replace(/=+$/, '')}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  const api = `${environment.apiUrl}/auth`;
  const response = () => ({ token: fakeJwt(), username: 'tester', fullName: 'Tester' });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: DummyPage },
          { path: 'profile', component: DummyPage, canActivate: [() => true] }
        ])
      ]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    service.ngOnDestroy();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('เริ่มต้นยังไม่ login', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.getToken()).toBeNull();
  });

  it('login() ส่ง rememberMe ไป backend พร้อม withCredentials (ให้ browser รับ refresh cookie)', () => {
    service.login('user1', 'pass1234', true).subscribe();

    const req = httpMock.expectOne(`${api}/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'user1', password: 'pass1234', rememberMe: true });
    expect(req.request.withCredentials).toBeTrue();
    req.flush(response());
  });

  it('login() ไม่ระบุ rememberMe -> ส่ง false', () => {
    service.login('user1', 'pass1234').subscribe();
    const req = httpMock.expectOne(`${api}/login`);
    expect(req.request.body.rememberMe).toBeFalse();
    req.flush(response());
  });

  it('login สำเร็จ: เก็บ access token ใน memory และอัปเดต user$/loggedIn$ — ไม่เขียน token/รหัสผ่านลง storage', () => {
    const states: boolean[] = [];
    service.loggedIn$.subscribe(v => states.push(v));
    const res = response();

    service.login('user1', 'secret-pass', true).subscribe();
    httpMock.expectOne(`${api}/login`).flush(res);

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getToken()).toBe(res.token);
    expect(service.getUsername()).toBe('tester');
    expect(states).toEqual([false, true]);

    const everything = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(everything).not.toContain(res.token);
    expect(everything).not.toContain('secret-pass');
  });

  it('login ไม่ผ่าน (401) -> ยังไม่ login และส่ง error ต่อให้ฟอร์มแสดงข้อความ', () => {
    let status = 0;
    service.login('user1', 'wrong').subscribe({ error: err => (status = err.status) });
    httpMock.expectOne(`${api}/login`).flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('restoreSession(): cookie ยังใช้ได้ -> ได้ access token ใหม่และ login อยู่ (กรณี Remember me เปิดเบราว์เซอร์ใหม่)', () => {
    let done = false;
    service.restoreSession().subscribe(() => (done = true));

    const req = httpMock.expectOne(`${api}/refresh`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(response());

    expect(done).toBeTrue();
    expect(service.isLoggedIn()).toBeTrue();
  });

  it('restoreSession(): ไม่มี cookie (401) -> ไม่ error แค่เริ่มแบบยังไม่ login', () => {
    let done = false;
    service.restoreSession().subscribe({ next: () => (done = true), error: () => fail('ต้องไม่ error') });
    httpMock.expectOne(`${api}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(done).toBeTrue();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('refresh() ที่ถูกเรียกพร้อมกันหลายครั้ง ยิง /refresh แค่ครั้งเดียว', () => {
    const tokens: string[] = [];
    service.refresh().subscribe(t => tokens.push(t));
    service.refresh().subscribe(t => tokens.push(t));

    const res = response();
    httpMock.expectOne(`${api}/refresh`).flush(res);
    expect(tokens).toEqual([res.token, res.token]);
  });

  it('refresh() ล้มเพราะเน็ต/backend ล่ม (ไม่ใช่ 401) -> ไม่ล้างสถานะ login', () => {
    service.login('user1', 'pass').subscribe();
    httpMock.expectOne(`${api}/login`).flush(response());

    service.refresh().subscribe({ error: () => undefined });
    httpMock.expectOne(`${api}/refresh`).error(new ProgressEvent('error'));

    expect(service.isLoggedIn()).toBeTrue();
  });

  it('logout(): ล้างสถานะทันทีและเรียก /logout พร้อม cookie ให้ backend revoke refresh token', () => {
    service.login('user1', 'pass').subscribe();
    httpMock.expectOne(`${api}/login`).flush(response());

    service.logout();

    expect(service.isLoggedIn()).toBeFalse();
    expect(service.getToken()).toBeNull();
    const req = httpMock.expectOne(`${api}/logout`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('logout() ขณะอยู่หน้าที่ต้อง login -> พากลับหน้าหลัก', async () => {
    service.login('user1', 'pass').subscribe();
    httpMock.expectOne(`${api}/login`).flush(response());
    await router.navigateByUrl('/profile');

    service.logout();
    httpMock.expectOne(`${api}/logout`).flush(null);
    await new Promise(resolve => setTimeout(resolve));

    expect(router.url).toBe('/');
  });

  it('ลบ token เก่าจากระบบเดิมที่ค้างใน localStorage/sessionStorage ทิ้งตอนเริ่ม', () => {
    localStorage.setItem('token', 'legacy');
    sessionStorage.setItem('token', 'legacy');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    TestBed.inject(AuthService);

    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    // ป้องกัน afterEach ไปเรียก verify() กับ testing module ที่รีเซ็ตไปแล้ว
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('register(): auto-login และส่ง withCredentials (backend ตั้ง session cookie)', () => {
    service.register('user1', 'user1@example.com', 'Passw0rd!', true).subscribe();
    const req = httpMock.expectOne(`${api}/register`);
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.body).toEqual({ username: 'user1', email: 'user1@example.com', password: 'Passw0rd!', rememberMe: true });
    req.flush(response());

    expect(service.isLoggedIn()).toBeTrue();
  });

  it('loginWithGoogle(): ส่งแค่ code + rememberMe พร้อม X-Requested-With และ withCredentials แล้ว login แบบเดียวกับ login()', () => {
    const res = response();
    service.loginWithGoogle('google-code', true).subscribe();

    const req = httpMock.expectOne(`${api}/google`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: 'google-code', rememberMe: true });
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(res);

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getToken()).toBe(res.token);
  });

  it('loginWithGoogle() ไม่ผ่าน -> ยังไม่ login และส่ง error ต่อให้ฟอร์ม', () => {
    let failed: unknown;
    service.loginWithGoogle('bad').subscribe({ error: e => (failed = e) });
    httpMock.expectOne(`${api}/google`).flush({ code: 'GOOGLE_AUTH_FAILED', message: 'x' }, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBeDefined();
    expect(service.isLoggedIn()).toBeFalse();
  });
});
