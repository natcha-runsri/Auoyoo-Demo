import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { ForgotPasswordModalComponent, RESET_SUCCESS_NOTICE } from './forgot-password-modal.component';
import { PasswordResetService } from '../services/password-reset/password-reset.service';
import { AuthModalService } from '../services/auth-modal/auth-modal.service';
import { AuthService } from '../services/authen/auth.service';

const SENT = { message: 'sent', expiresInSeconds: 300, resendAfterSeconds: 60 };

describe('ForgotPasswordModalComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordModalComponent>;
  let component: ForgotPasswordModalComponent;
  let api: jasmine.SpyObj<PasswordResetService>;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let auth: jasmine.SpyObj<AuthService>;
  let el: HTMLElement;

  const text = (selector: string) => el.querySelector(selector)?.textContent?.trim() ?? '';
  const render = () => { fixture.detectChanges(); tick(); fixture.detectChanges(); };

  function badRequest(code: string, message = 'x'): HttpErrorResponse {
    return new HttpErrorResponse({ status: 400, error: { code, message } });
  }

  /** ผ่านขั้น 1 ไปถึงขั้น 2 */
  function goToCodeStep(): void {
    api.forgotPassword.and.returnValue(of(SENT));
    component.emailForm.setValue({ email: 'me@example.com' });
    component.submitEmail();
    render();
  }

  /** ผ่านขั้น 2 ไปถึงขั้น 3 */
  function goToPasswordStep(): void {
    goToCodeStep();
    api.verifyCode.and.returnValue(of({ resetToken: 'reset-1', expiresInSeconds: 600 }));
    component.onOtpCompleted('123456');
    render();
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<PasswordResetService>('PasswordResetService', ['forgotPassword', 'verifyCode', 'resetPassword']);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['switchTo', 'close']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn']);
    auth.isLoggedIn.and.returnValue(false);
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordModalComponent],
      providers: [{ provide: PasswordResetService, useValue: api }, { provide: AuthModalService, useValue: authModal },
        { provide: AuthService, useValue: auth }]
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordModalComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  // ===== ขั้นที่ 1 =====

  it('ขั้นที่ 1: error อีเมลขึ้นหลังกดปุ่มเท่านั้น และไม่เรียก API ถ้าอีเมลผิดรูป', () => {
    component.emailForm.setValue({ email: 'not-an-email' });
    fixture.detectChanges();
    expect(el.querySelector('.fp-error.visible')).toBeNull();

    component.submitEmail();
    fixture.detectChanges();
    expect(text('#fp-email-error')).toBe('รูปแบบอีเมลไม่ถูกต้อง');
    expect(api.forgotPassword).not.toHaveBeenCalled();
  });

  it('ขั้นที่ 1 -> 2: ส่งอีเมลแล้วไปขั้นกรอกรหัส แสดงอีเมลที่กรอก และเริ่มนับถอยหลัง 60 วินาที', fakeAsync(() => {
    goToCodeStep();

    expect(api.forgotPassword).toHaveBeenCalledWith('me@example.com');
    expect(component.step).toBe('code');
    expect(text('.fp-title')).toBe('กรอกรหัสยืนยัน');
    expect(text('.fp-desc')).toContain('me@example.com');
    expect(el.querySelectorAll('app-otp-input input').length).toBe(6);
    expect(text('.fp-resend-wait')).toBe('ส่งอีกครั้งได้ใน 1:00');
    discardPeriodicTasks();
  }));

  it('ยกเลิก (ยังไม่ล็อกอิน มาจาก popup login) -> กลับไป popup login', () => {
    (el.querySelector('.fp-cancel') as HTMLButtonElement).click();
    expect(authModal.switchTo).toHaveBeenCalledWith('login');
    expect(authModal.close).not.toHaveBeenCalled();
  });

  it('ยกเลิก ตอนล็อกอินอยู่ (เช่น มาจากหน้าโปรไฟล์) -> แค่ปิด popup ไม่พาไป login', () => {
    auth.isLoggedIn.and.returnValue(true);
    (el.querySelector('.fp-cancel') as HTMLButtonElement).click();
    expect(authModal.close).toHaveBeenCalled();
    expect(authModal.switchTo).not.toHaveBeenCalled();
  });

  it('ทุกขั้น (อีเมล / รหัส / รหัสผ่านใหม่) submit แล้วไม่ submit แบบ native', fakeAsync(() => {
    const submitPrevented = () => {
      const submit = new Event('submit', { cancelable: true });
      el.querySelector('form')!.dispatchEvent(submit);
      return submit.defaultPrevented;
    };
    expect(submitPrevented()).withContext('ขั้นอีเมล').toBeTrue();
    goToCodeStep();
    expect(submitPrevented()).withContext('ขั้นรหัส').toBeTrue();
    api.verifyCode.and.returnValue(of({ resetToken: 'reset-1', expiresInSeconds: 600 }));
    component.onOtpCompleted('123456');
    render();
    expect(submitPrevented()).withContext('ขั้นรหัสผ่านใหม่').toBeTrue();
    discardPeriodicTasks();
  }));

  it('ขั้นที่ 2: กด "ยืนยันตัวตน" ก่อนกรอกครบ 6 หลัก -> ไม่ submit แบบ native (หน้าไม่โหลดใหม่) และแจ้งให้กรอกให้ครบ', fakeAsync(() => {
    goToCodeStep();
    const submit = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(submit);
    fixture.detectChanges();
    expect(submit.defaultPrevented).toBeTrue();
    expect(text('.fp-error.visible')).toBe('กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก');
    expect(api.verifyCode).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  it('ขั้นที่ 1 โดน 429 (เพิ่งขอไป) -> ยังไปขั้นที่ 2 และนับถอยหลังตาม Retry-After', fakeAsync(() => {
    api.forgotPassword.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 429, headers: new HttpHeaders({ 'Retry-After': '42' }), error: { message: 'wait' }
    })));
    component.emailForm.setValue({ email: 'me@example.com' });
    component.submitEmail();
    render();

    expect(component.step).toBe('code');
    expect(text('.fp-resend-wait')).toBe('ส่งอีกครั้งได้ใน 0:42');
    discardPeriodicTasks();
  }));

  // ===== ขั้นที่ 2 =====

  it('นับถอยหลัง: ทุกวินาทีลดลง ครบ 60 วินาทีแล้วกด "ส่งรหัสอีกครั้ง" ได้', fakeAsync(() => {
    goToCodeStep();

    tick(1000);
    fixture.detectChanges();
    expect(text('.fp-resend-wait')).toBe('ส่งอีกครั้งได้ใน 0:59');
    expect(el.querySelector('.fp-resend-link')).toBeNull();

    tick(59_000);
    fixture.detectChanges();
    expect(el.querySelector('.fp-resend-wait')).toBeNull();
    expect(text('.fp-resend-link')).toBe('ส่งรหัสอีกครั้ง');

    (el.querySelector('.fp-resend-link') as HTMLButtonElement).click();
    render();
    expect(api.forgotPassword).toHaveBeenCalledTimes(2);
    expect(text('.fp-resend-wait')).toBe('ส่งอีกครั้งได้ใน 1:00');
    discardPeriodicTasks();
  }));

  it('รหัสผิด -> ช่องเป็นสีแดง แสดง "รหัสยืนยันไม่ถูกต้อง" ล้างช่อง และ focus ช่องแรก', fakeAsync(() => {
    document.body.appendChild(el);
    goToCodeStep();
    api.verifyCode.and.returnValue(throwError(() => badRequest('INVALID_CODE')));

    component.onOtpCompleted('111111');
    render();

    expect(api.verifyCode).toHaveBeenCalledWith('me@example.com', '111111');
    expect(el.querySelector('.otp-invalid')).not.toBeNull();
    expect(text('.fp-error.visible')).toBe('รหัสยืนยันไม่ถูกต้อง');
    const boxes = Array.from(el.querySelectorAll<HTMLInputElement>('app-otp-input input'));
    expect(boxes.every(b => b.value === '')).toBeTrue();
    expect(document.activeElement).toBe(boxes[0]);
    el.remove();
    discardPeriodicTasks();
  }));

  it('รหัสหมดอายุ -> "รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่"', fakeAsync(() => {
    goToCodeStep();
    api.verifyCode.and.returnValue(throwError(() => badRequest('CODE_EXPIRED')));

    component.onOtpCompleted('123456');
    render();

    expect(text('.fp-error.visible')).toBe('รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่');
    discardPeriodicTasks();
  }));

  it('กดยืนยันตัวตนทั้งที่ยังกรอกไม่ครบ -> ไม่เรียก API', fakeAsync(() => {
    goToCodeStep();
    component.onOtpChanged('123');
    component.submitCode();
    render();

    expect(api.verifyCode).not.toHaveBeenCalled();
    expect(text('.fp-error.visible')).toBe('กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก');
    discardPeriodicTasks();
  }));

  it('ระหว่างรอ API ปุ่มยืนยันตัวตน disabled และกดซ้ำไม่ยิงซ้ำ', fakeAsync(() => {
    goToCodeStep();
    api.verifyCode.and.returnValue(new Subject<never>());

    component.onOtpCompleted('123456');
    component.submitCode();
    fixture.detectChanges();

    expect(api.verifyCode).toHaveBeenCalledTimes(1);
    expect((el.querySelector('.fp-submit') as HTMLButtonElement).disabled).toBeTrue();
    discardPeriodicTasks();
  }));

  // ===== ขั้นที่ 3 =====

  it('ขั้นที่ 2 -> 3: รหัสถูกแล้วไปหน้าสร้างรหัสผ่านใหม่', fakeAsync(() => {
    goToPasswordStep();
    expect(component.step).toBe('password');
    expect(text('.fp-title')).toBe('สร้างรหัสผ่านใหม่');
    discardPeriodicTasks();
  }));

  it('รหัสผ่านไม่ตรงกัน -> "รหัสผ่านไม่ตรงกัน" และไม่เรียก API', fakeAsync(() => {
    goToPasswordStep();
    component.passwordForm.setValue({ newPassword: 'NewPassw0rd!', confirmPassword: 'Different1!' });
    component.submitPassword();
    fixture.detectChanges();

    expect(text('#fp-confirm-password-error')).toBe('รหัสผ่านไม่ตรงกัน');
    expect(api.resetPassword).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  it('รหัสผ่านไม่ผ่านกฎเดียวกับ register -> แจ้งข้อแรกที่ไม่ผ่าน', fakeAsync(() => {
    goToPasswordStep();
    component.passwordForm.setValue({ newPassword: 'weakpassword', confirmPassword: 'weakpassword' });
    component.submitPassword();
    fixture.detectChanges();

    expect(text('#fp-new-password-error')).toBe('รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว');
    discardPeriodicTasks();
  }));

  it('รหัสใหม่ซ้ำรหัสเดิม -> error ใต้ช่องรหัสผ่านใหม่', fakeAsync(() => {
    goToPasswordStep();
    api.resetPassword.and.returnValue(throwError(() => badRequest('SAME_PASSWORD', 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม')));
    component.passwordForm.setValue({ newPassword: 'OldPassw0rd!', confirmPassword: 'OldPassw0rd!' });
    component.submitPassword();
    render();

    expect(text('#fp-new-password-error')).toBe('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    discardPeriodicTasks();
  }));

  it('สำเร็จ -> ใช้ resetToken (ไม่ส่งรหัส 6 หลักซ้ำ) แล้วกลับ popup login พร้อม username และข้อความสำเร็จ', fakeAsync(() => {
    goToPasswordStep();
    api.resetPassword.and.returnValue(of({ message: 'ok', username: 'tester' }));
    component.passwordForm.setValue({ newPassword: 'NewPassw0rd!', confirmPassword: 'NewPassw0rd!' });
    component.submitPassword();
    render();

    expect(api.resetPassword).toHaveBeenCalledWith('reset-1', 'NewPassw0rd!');
    expect(authModal.switchTo).toHaveBeenCalledWith('login', { username: 'tester', notice: RESET_SUCCESS_NOTICE });
    discardPeriodicTasks();
  }));

  it('reset token หมดอายุ -> แจ้งและกด "เริ่มใหม่" กลับขั้นที่ 1 โดยเก็บอีเมลไว้', fakeAsync(() => {
    goToPasswordStep();
    api.resetPassword.and.returnValue(throwError(() => badRequest('INVALID_RESET_TOKEN', 'หมดอายุ')));
    component.passwordForm.setValue({ newPassword: 'NewPassw0rd!', confirmPassword: 'NewPassw0rd!' });
    component.submitPassword();
    render();

    (el.querySelector('.fp-restart') as HTMLButtonElement).click();
    render();
    expect(component.step).toBe('email');
    expect(component.emailForm.controls.email.value).toBe('me@example.com');
    discardPeriodicTasks();
  }));
});
