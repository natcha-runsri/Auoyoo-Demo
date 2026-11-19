import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { LOGIN_FAILED_MESSAGE, LoginComponent } from './login.component';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { GoogleSignInError, GoogleSignInService } from '../../services/google-sign-in/google-sign-in.service';
import { GOOGLE_MESSAGES } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let auth: jasmine.SpyObj<AuthService>;
  let el: HTMLElement;

  let google: jasmine.SpyObj<GoogleSignInService>;
  let googleEnabled: boolean;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'loginWithGoogle']);
    googleEnabled = false;
    google = jasmine.createSpyObj<GoogleSignInService>('GoogleSignInService', ['preload', 'requestCode']);
    Object.defineProperty(google, 'enabled', { get: () => googleEnabled });

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: AuthService, useValue: auth },
        { provide: GoogleSignInService, useValue: google }]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('label ผูกกับ input', () => {
    expect(el.querySelector('label[for="login-username"]')).toBeTruthy();
    expect(el.querySelector('input#login-username')).toBeTruthy();
    expect(el.querySelector('input#login-password')).toBeTruthy();
  });

  it('เพิ่งเปิด / คลิกหรือ Tab ผ่านช่อง (ยังไม่กด Login) -> ไม่แสดง error', () => {
    for (const id of ['login-username', 'login-password']) {
      const input = el.querySelector(`#${id}`) as HTMLInputElement;
      input.dispatchEvent(new Event('focus'));
      input.value = 'x';
      input.dispatchEvent(new Event('input'));
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    }
    fixture.detectChanges();
    expect(el.querySelectorAll('.field-error.visible').length).toBe(0);
  });

  it('หลังกด Login แล้ว แก้ช่องไหนถูก error ช่องนั้นหายทันที', () => {
    component.onLogin();
    component.form.controls.username.setValue('user1');
    fixture.detectChanges();
    expect(el.querySelector('#login-username-error')?.classList).not.toContain('visible');
    expect(el.querySelector('#login-password-error')?.classList).toContain('visible');
  });

  it('submit ฟอร์ม -> ไม่ submit แบบ native (หน้าไม่โหลดใหม่)', () => {
    const submit = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBeTrue();
  });

  it('submit ฟอร์มว่าง -> แสดง error ภาษาไทยใต้ช่อง และไม่เรียก API', () => {
    component.onLogin();
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    expect(el.querySelector('#login-username-error')?.textContent).toContain('กรุณากรอกชื่อผู้ใช้');
    expect(el.querySelector('#login-password-error')?.textContent).toContain('กรุณากรอกรหัสผ่าน');
  });

  it('ระหว่างรอ API ปุ่ม Login disabled และกดซ้ำไม่ยิงซ้ำ', () => {
    const pending = new Subject<never>();
    auth.login.and.returnValue(pending);
    component.form.setValue({ username: 'user1', password: 'pass', rememberMe: true });

    component.onLogin();
    component.onLogin();
    fixture.detectChanges();

    expect(auth.login).toHaveBeenCalledOnceWith('user1', 'pass', true);
    expect((el.querySelector('.login-submit') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('login ไม่ผ่าน (401) -> แสดงข้อความในกล่อง คงชื่อผู้ใช้ไว้ และไม่ปิด popup', () => {
    const result = new Subject<never>();
    auth.login.and.returnValue(result);
    const closed = jasmine.createSpy('loginSuccess');
    component.loginSuccess.subscribe(closed);
    component.form.setValue({ username: 'user1', password: 'wrong', rememberMe: false });

    component.onLogin();
    result.error({ status: 401 });
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(LOGIN_FAILED_MESSAGE);
    expect(component.form.controls.username.value).toBe('user1');
    expect(closed).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('สลับมาจาก "Back to Login" -> เติม username ที่กรอกไว้ในฟอร์มสมัคร', () => {
    TestBed.inject(AuthModalService).switchTo('login', { username: 'fromRegister' });
    const next = TestBed.createComponent(LoginComponent);
    next.detectChanges();

    expect(next.componentInstance.form.controls.username.value).toBe('fromRegister');
    expect(next.nativeElement.querySelector('#login-password').hasAttribute('data-autofocus')).toBeTrue();
  });

  it('หลังตั้งรหัสผ่านใหม่สำเร็จ -> แสดงข้อความสีเขียวและเติม username', () => {
    TestBed.inject(AuthModalService).switchTo('login', { username: 'tester', notice: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ' });
    const next = TestBed.createComponent(LoginComponent);
    next.detectChanges();

    expect(next.nativeElement.querySelector('.notice[role="status"]')?.textContent).toContain('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ');
    expect(next.componentInstance.form.controls.username.value).toBe('tester');
  });

  it('ปุ่มรูปตาสลับแสดง/ซ่อนรหัสผ่าน', () => {
    const input = el.querySelector('#login-password') as HTMLInputElement;
    const toggle = el.querySelector('.toggle-password') as HTMLButtonElement;
    expect(input.type).toBe('password');

    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  describe('เข้าสู่ระบบด้วย Google', () => {
    const googleButton = () => el.querySelector('.google-btn') as HTMLButtonElement | null;

    function enableGoogle(): void {
      googleEnabled = true;
      fixture.detectChanges();
    }

    async function clickGoogle(): Promise<void> {
      googleButton()!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('backend ยังไม่ตั้ง Client ID -> ไม่มีปุ่ม Google และเส้นคั่น', () => {
      expect(googleButton()).toBeNull();
      expect(el.querySelector('.or-divider')).toBeNull();
    });

    it('มี Client ID -> ปุ่มอยู่ใต้ฟอร์มเดิม คั่นด้วย "หรือ", เป็นปุ่ม type=button กว้างเต็มฟอร์ม สูงอย่างน้อย 44px; โหลดสคริปต์ไว้ก่อน', () => {
      enableGoogle();
      expect(google.preload).toHaveBeenCalled();
      expect(el.querySelector('.or-divider')?.textContent?.trim()).toBe('หรือ');
      const button = googleButton()!;
      expect(button.type).toBe('button');
      expect(button.textContent?.trim()).toBe('เข้าสู่ระบบด้วย Google');
      expect(button.querySelector('svg.google-g')).not.toBeNull();
      const form = el.querySelector('.login-form') as HTMLElement;
      expect(button.getBoundingClientRect().width).toBeCloseTo(form.getBoundingClientRect().width, 0);
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      // อยู่หลังปุ่ม Login / Sign up
      expect(el.querySelector('.signup-link')!.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('กดแล้ว: แสดงสถานะกำลังโหลด -> ส่ง code ให้ backend พร้อม Remember me -> สำเร็จแล้วปิด modal', async () => {
      enableGoogle();
      let resolveCode!: (code: string) => void;
      google.requestCode.and.returnValue(new Promise(r => (resolveCode = r)));
      auth.loginWithGoogle.and.returnValue(of({ token: 't', username: 'g', fullName: null }));
      let succeeded = false;
      component.loginSuccess.subscribe(() => (succeeded = true));
      component.form.controls.rememberMe.setValue(true);

      googleButton()!.click();
      fixture.detectChanges();
      expect(googleButton()!.disabled).toBeTrue();
      expect(googleButton()!.getAttribute('aria-busy')).toBe('true');
      expect(googleButton()!.textContent?.trim()).toBe('กำลังเข้าสู่ระบบด้วย Google...');

      resolveCode('auth-code');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(auth.loginWithGoogle).toHaveBeenCalledOnceWith('auth-code', true);
      expect(succeeded).toBeTrue();
      expect(component.googleLoading).toBeFalse();
    });

    it('ผู้ใช้ปิด popup -> ข้อความภาษาไทย ไม่เรียก backend และกดใหม่ได้', async () => {
      enableGoogle();
      google.requestCode.and.returnValue(Promise.reject(new GoogleSignInError('cancelled')));
      await clickGoogle();
      expect(el.querySelector('.google-error')?.textContent?.trim()).toBe(GOOGLE_MESSAGES.cancelled);
      expect(auth.loginWithGoogle).not.toHaveBeenCalled();
      expect(googleButton()!.disabled).toBeFalse();
    });

    it('เบราว์เซอร์บล็อก popup / โหลดสคริปต์ไม่ได้ -> ข้อความบอกวิธีแก้', async () => {
      enableGoogle();
      google.requestCode.and.returnValue(Promise.reject(new GoogleSignInError('popup_blocked')));
      await clickGoogle();
      expect(el.querySelector('.google-error')?.textContent?.trim()).toBe(GOOGLE_MESSAGES.popup_blocked);

      google.requestCode.and.returnValue(Promise.reject(new GoogleSignInError('unavailable')));
      await clickGoogle();
      expect(el.querySelector('.google-error')?.textContent?.trim()).toBe(GOOGLE_MESSAGES.unavailable);
    });

    it('backend ปฏิเสธ (เช่น อีเมลยังไม่ยืนยัน) -> แสดงข้อความภาษาไทยจาก backend; ต่อเซิร์ฟเวอร์ไม่ได้ -> ข้อความ network', async () => {
      enableGoogle();
      google.requestCode.and.resolveTo('auth-code');
      auth.loginWithGoogle.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 403, error: { code: 'GOOGLE_EMAIL_NOT_VERIFIED', message: 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล จึงใช้เข้าสู่ระบบไม่ได้' } })));
      await clickGoogle();
      expect(el.querySelector('.google-error')?.textContent?.trim()).toBe('บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล จึงใช้เข้าสู่ระบบไม่ได้');

      auth.loginWithGoogle.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      await clickGoogle();
      expect(el.querySelector('.google-error')?.textContent?.trim()).toBe(GOOGLE_MESSAGES.network);
    });
  });

  describe('ผูก Google เข้าบัญชีเดิมครั้งแรก', () => {
    beforeEach(() => {
      googleEnabled = true;
      fixture.detectChanges();
      google.requestCode.and.resolveTo('auth-code');
      auth.loginWithGoogle.and.returnValue(of({ token: 't', username: 'alice', fullName: null, googleLinked: true }));
    });

    async function linkWithGoogle(): Promise<boolean[]> {
      const emitted: boolean[] = [];
      component.loginSuccess.subscribe(() => emitted.push(true));
      (el.querySelector('.google-btn') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      return emitted;
    }

    it('แจ้งเป็นภาษาไทยว่าผูกแล้วและรหัสผ่านเดิมถูกยกเลิก — ยังไม่ปิด modal จนกด "ตกลง"', async () => {
      const emitted = await linkWithGoogle();

      expect(el.querySelector('form.login-form')).toBeNull();
      const notice = el.querySelector('.linked-notice') as HTMLElement;
      expect(notice.getAttribute('role')).toBe('status');
      expect(notice.querySelector('#login-linked-title')?.textContent?.trim()).toBe('ผูกบัญชีกับ Google แล้ว');
      // ฟอร์มถูกถอดออกแล้ว -> มีหัวข้อเดียว และไม่มี id ซ้ำ
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(el.querySelector('#login-title')).toBeNull();
      expect(notice.textContent).toContain('รหัสผ่านเดิมของบัญชีนี้ถูกยกเลิกแล้ว');
      expect(notice.textContent).toContain('ตั้งรหัสผ่านใหม่ที่หน้าโปรไฟล์');
      expect(emitted).toEqual([]);

      (Array.from(notice.querySelectorAll('button')).find(b => b.textContent?.trim() === 'ตกลง') as HTMLButtonElement).click();
      expect(emitted).toEqual([true]);
    });

    it('ปุ่ม "ไปตั้งรหัสผ่านที่หน้าโปรไฟล์" -> ปิด modal แล้วไปหน้าโปรไฟล์', async () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const emitted = await linkWithGoogle();

      (el.querySelector('.linked-notice .signup-link') as HTMLButtonElement).click();
      expect(emitted).toEqual([true]);
      expect(navigate).toHaveBeenCalledWith(['/profile']);
    });

    it('ล็อกอินด้วย Google ครั้งต่อไป (ไม่มี googleLinked) -> ปิด modal ทันทีเหมือนเดิม', async () => {
      auth.loginWithGoogle.and.returnValue(of({ token: 't', username: 'alice', fullName: null }));
      const emitted = await linkWithGoogle();
      expect(emitted).toEqual([true]);
      expect(el.querySelector('.linked-notice')).toBeNull();
    });
  });

  it('มีลิงก์นโยบายความเป็นส่วนตัว (แม้ปิดปุ่ม Google) — กดแล้วปิด modal และไป /privacy', () => {
    const authModal = TestBed.inject(AuthModalService);
    const close = spyOn(authModal, 'close');
    const link = el.querySelector('.privacy-note a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('นโยบายความเป็นส่วนตัว');
    expect(link.getAttribute('href')).toBe('/privacy');

    link.click();
    expect(close).toHaveBeenCalled();
  });
});
