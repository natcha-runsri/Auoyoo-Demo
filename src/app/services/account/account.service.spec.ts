import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountService } from './account.service';
import { AuthService } from '../authen/auth.service';
import { environment } from '../../../environments/environment';

describe('AccountService', () => {
  let service: AccountService;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  const base = `${environment.apiUrl}/users/me`;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['applyNewSession']);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }]
    });
    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('แต่ละงานยิง endpoint ของตัวเอง', () => {
    service.confirmPassword('pw').subscribe();
    http.expectOne(r => r.method === 'POST' && r.url === `${base}/password-confirm`).flush({ token: 't', expiresInSeconds: 600 });
    service.requestEmailCode('t', 'new@example.com').subscribe();
    const emailCode = http.expectOne(`${base}/email/code`);
    expect(emailCode.request.body).toEqual({ token: 't', newEmail: 'new@example.com' });
    emailCode.flush({});
    service.confirmEmailChange('t', '123456').subscribe();
    http.expectOne(`${base}/email/confirm`).flush({ email: 'new@example.com' });
    service.requestPasswordCode().subscribe();
    http.expectOne(`${base}/password/code`).flush({});
    service.verifyPasswordCode('654321').subscribe();
    expect(http.expectOne(`${base}/password/verify`).request.body).toEqual({ code: '654321' });
  });

  it('เปลี่ยนรหัสผ่านสำเร็จ -> ใช้ token ใหม่ของเครื่องนี้ทันที', () => {
    const res = { token: 'new-access', username: 'alice' };
    service.changePassword('reset-1', 'NewPass!123').subscribe();
    const req = http.expectOne(`${base}/password`);
    expect(req.request.body).toEqual({ resetToken: 'reset-1', newPassword: 'NewPass!123' });
    req.flush(res);
    expect(auth.applyNewSession).toHaveBeenCalledWith(jasmine.objectContaining(res));
  });
});
