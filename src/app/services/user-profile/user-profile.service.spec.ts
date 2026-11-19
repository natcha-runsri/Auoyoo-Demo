import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CurrentUser, UserProfileService } from './user-profile.service';
import { AuthService } from '../authen/auth.service';
import { environment } from '../../../environments/environment';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  const base = `${environment.apiUrl}/users/me`;
  const USER: CurrentUser = { username: 'alice', email: 'alice@example.com', avatarUrl: 'https://images.example.com/demo/a.jpg' };

  function loadUser(): void {
    service.loadCurrentUser();
    http.expectOne(base).flush(USER);
  }

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn', 'renameUser']);
    auth.isLoggedIn.and.returnValue(true);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }]
    });
    service = TestBed.inject(UserProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('เปลี่ยนชื่อสำเร็จ -> currentUser$ (navbar/เมนู) และชื่อใน AuthService เปลี่ยนทันที', () => {
    loadUser();
    const seen: (string | undefined)[] = [];
    service.currentUser$.subscribe(u => seen.push(u?.username));
    service.changeUsername('bobby').subscribe();
    const req = http.expectOne(`${base}/username`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ username: 'bobby' });
    req.flush({ ...USER, username: 'bobby' });
    expect(seen).toEqual(['alice', 'bobby']);
    expect(auth.renameUser).toHaveBeenCalledWith('bobby');
  });

  it('อัปโหลดรูปสำเร็จ -> avatarUrl ใหม่ใน currentUser$ ทันที (ไม่ยิงไป Cloudinary ตรง ส่งผ่าน backend)', () => {
    loadUser();
    const file = new File([new Uint8Array(4)], 'a.png', { type: 'image/png' });
    service.uploadAvatar(file).subscribe();
    const req = http.expectOne(`${base}/avatar`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('file')).toBe(file);
    req.flush({ avatarUrl: 'https://images.example.com/demo/new.jpg' });
    expect(service.currentUser?.avatarUrl).toBe('https://images.example.com/demo/new.jpg');
  });

  it('setEmail -> อีเมลหน้าโปรไฟล์เปลี่ยนทันที', () => {
    loadUser();
    service.setEmail('new@example.com');
    expect(service.currentUser?.email).toBe('new@example.com');
  });
});
