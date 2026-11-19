import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { AuthModalHostComponent } from './auth-modal-host.component';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { AuthService } from '../../services/authen/auth.service';
import { AccountService } from '../../services/account/account.service';
import { EmailChangeModalComponent } from '../account-modals/email-change-modal.component';

describe('AuthModalHostComponent (popup หน้าโปรไฟล์)', () => {
  let fixture: ComponentFixture<AuthModalHostComponent>;
  let authModal: AuthModalService;
  let loggedIn$: BehaviorSubject<boolean>;
  let el: HTMLElement;

  const render = () => { fixture.detectChanges(); tick(); fixture.detectChanges(); };

  beforeEach(async () => {
    loggedIn$ = new BehaviorSubject(true);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn', 'getUsername'], { loggedIn$: loggedIn$.asObservable() });
    const account = jasmine.createSpyObj<AccountService>('AccountService', ['confirmPassword']);
    account.confirmPassword.and.returnValue(of({ token: 'act-1', expiresInSeconds: 600 }));
    await TestBed.configureTestingModule({
      imports: [AuthModalHostComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: AuthService, useValue: auth }, { provide: AccountService, useValue: account }]
    }).compileComponents();
    authModal = TestBed.inject(AuthModalService);
    fixture = TestBed.createComponent(AuthModalHostComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => (document.body.style.overflow = ''));

  it('แก้ไขอีเมล: กรอบฟ้าอ่อน มีชื่อ dialog และมี popup เดียว', fakeAsync(() => {
    authModal.open('email-change');
    render();
    const box = el.querySelector('.auth-modal-box')!;
    expect(box.classList).toContain('auth-modal-box--soft');
    expect(box.getAttribute('aria-labelledby')).toBe('email-change-title');
    expect(el.querySelectorAll('[role=dialog]').length).toBe(1);
    expect(el.querySelector('app-email-change-modal')).not.toBeNull();
    tick(200);
  }));

  it('"ลืมรหัสผ่าน?" สลับเป็น popup ลืมรหัสผ่าน (กรอบเดิมของมัน) โดยไม่ซ้อน', fakeAsync(() => {
    authModal.open('email-change');
    render();
    (el.querySelector('.acc-forgot') as HTMLButtonElement).click();
    render();
    expect(el.querySelectorAll('[role=dialog]').length).toBe(1);
    expect(el.querySelector('app-email-change-modal')).toBeNull();
    expect(el.querySelector('app-forgot-password-modal')).not.toBeNull();
    expect(el.querySelector('.auth-modal-box')!.classList).toContain('auth-modal-box--plain');
    expect(el.querySelector('.auth-modal-box')!.classList).not.toContain('auth-modal-box--soft');
  }));

  it('ปิดกลางทางแล้วเปิดใหม่ -> เริ่มขั้นแรกเสมอ', fakeAsync(() => {
    authModal.open('email-change');
    render();
    const first = fixture.debugElement.query(d => d.componentInstance instanceof EmailChangeModalComponent)
      .componentInstance as EmailChangeModalComponent;
    first.passwordForm.setValue({ password: 'Current!123' });
    first.submitPassword();
    render();
    expect(first.step).toBe(1);

    authModal.close();
    render();
    tick(200);
    fixture.detectChanges();
    expect(el.querySelector('app-email-change-modal')).toBeNull();

    authModal.open('email-change');
    render();
    const second = fixture.debugElement.query(d => d.componentInstance instanceof EmailChangeModalComponent)
      .componentInstance as EmailChangeModalComponent;
    expect(second).not.toBe(first);
    expect(second.step).toBe(0);
    tick(200);
  }));

  it('เปลี่ยนรหัสผ่าน: กรอบฟ้าอ่อน และปิดเองเมื่อออกจากระบบ', fakeAsync(() => {
    authModal.open('password-change');
    render();
    expect(el.querySelector('.auth-modal-box--soft')).not.toBeNull();
    expect(el.querySelector('app-password-change-modal')).not.toBeNull();

    loggedIn$.next(false);
    tick(200);
    fixture.detectChanges();
    expect(authModal.currentView).toBeNull();
    expect(el.querySelector('.auth-modal-box')).toBeNull();
  }));

  it('view login: aria-labelledby ชี้ทั้งหัวข้อฟอร์มและหัวข้อหน้าแจ้งผูก Google — ในหน้ามีอยู่ทีละอัน ชื่อ dialog จึงถูกเสมอ', fakeAsync(() => {
    authModal.open('login');
    render();
    const box = el.querySelector('.auth-modal-box')!;
    const ids = box.getAttribute('aria-labelledby')!.split(' ');
    expect(ids).toEqual(['login-title', 'login-linked-title']);
    const present = ids.map(id => el.querySelector('#' + id)).filter(Boolean);
    expect(present.length).toBe(1);
    expect(present[0]!.textContent).toContain('Welcome to');
    authModal.close();
    tick(200);
  }));
});
