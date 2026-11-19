import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/authen/auth.service';
import { environment } from '../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  const api = environment.apiUrl;
  const favoritesUrl = `${api}/favorites`;

  function loginWithToken(token: string): void {
    auth.login('tester', 'pass').subscribe();
    httpMock.expectOne(`${api}/auth/login`).flush({ token, username: 'tester', fullName: null });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    auth.ngOnDestroy();
  });

  it('แนบ Bearer token และ withCredentials กับ request ไป backend', () => {
    loginWithToken('access-1');

    http.get(favoritesUrl).subscribe();
    const req = httpMock.expectOne(favoritesUrl);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    expect(req.request.withCredentials).toBeTrue();
    req.flush([]);
  });

  it('ไม่แตะ request ที่ไปโดเมนอื่น', () => {
    loginWithToken('access-1');

    http.get('https://example.com/data').subscribe();
    const req = httpMock.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });

  it('เจอ 401 -> refresh 1 ครั้ง แล้วยิง request เดิมซ้ำด้วย token ใหม่', () => {
    loginWithToken('expired-token');

    let result: unknown;
    http.get(favoritesUrl).subscribe(r => (result = r));

    httpMock.expectOne(favoritesUrl).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${api}/auth/refresh`).flush({ token: 'fresh-token', username: 'tester', fullName: null });

    const retry = httpMock.expectOne(favoritesUrl);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retry.flush(['ok']);

    expect(result).toEqual(['ok']);
    expect(auth.isLoggedIn()).toBeTrue();
  });

  it('refresh ไม่ผ่าน (session หมดอายุ) -> บังคับ logout และส่ง error เดิมต่อ', () => {
    loginWithToken('expired-token');

    let status = 0;
    http.get(favoritesUrl).subscribe({ error: err => (status = err.status) });

    httpMock.expectOne(favoritesUrl).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${api}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.isLoggedIn()).toBeFalse();
  });

  it('retry แล้วยัง 401 -> ไม่ refresh วนซ้ำ', () => {
    loginWithToken('expired-token');

    let status = 0;
    http.get(favoritesUrl).subscribe({ error: err => (status = err.status) });

    httpMock.expectOne(favoritesUrl).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${api}/auth/refresh`).flush({ token: 'fresh-token', username: 'tester', fullName: null });
    httpMock.expectOne(favoritesUrl).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    httpMock.expectNone(`${api}/auth/refresh`);
  });

  it('login ผิดรหัส (401) ไม่ถูกตีความว่า token หมดอายุ', () => {
    auth.login('tester', 'wrong').subscribe({ error: () => undefined });
    httpMock.expectOne(`${api}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectNone(`${api}/auth/refresh`);
  });
});
