import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { EmailChangeModalComponent } from './email-change-modal.component';
import { AccountService, StepToken } from '../../services/account/account.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';

const SENT = { sentTo: 'new@example.com', expiresInSeconds: 300, resendAfterSeconds: 60 };

describe('EmailChangeModalComponent', () => {
  let fixture: ComponentFixture<EmailChangeModalComponent>;
  let component: EmailChangeModalComponent;
  let api: jasmine.SpyObj<AccountService>;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let profiles: jasmine.SpyObj<UserProfileService>;
  let el: HTMLElement;

  const text = (selector: string) => el.querySelector(selector)?.textContent?.trim() ?? '';
  const render = () => { fixture.detectChanges(); tick(); fixture.detectChanges(); };
  const error = (status: number, code: string, message = 'x', extra = {}) =>
    new HttpErrorResponse({ status, error: { code, message, ...extra } });

  function passIdentity(): void {
    api.confirmPassword.and.returnValue(of({ token: 'act-1', expiresInSeconds: 600 }));
    component.passwordForm.setValue({ password: 'Current!123' });
    component.submitPassword();
    render();
  }

  function goToCodeStep(): void {
    passIdentity();
    api.requestEmailCode.and.returnValue(of(SENT));
    component.emailForm.setValue({ email: 'new@example.com' });
    component.submitEmail();
    render();
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<AccountService>('AccountService', ['confirmPassword', 'requestEmailCode', 'confirmEmailChange']);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['switchTo', 'close']);
    profiles = jasmine.createSpyObj<UserProfileService>('UserProfileService', ['setEmail'],
      { currentUser: { username: 'alice', email: 'old@example.com', avatarUrl: null } });
    await TestBed.configureTestingModule({
      imports: [EmailChangeModalComponent],
      providers: [
        { provide: AccountService, useValue: api },
        { provide: AuthModalService, useValue: authModal },
        { provide: UserProfileService, useValue: profiles }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(EmailChangeModalComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  // ===== ขั้น 0 =====

  it('เปิดมาเริ่มที่ขั้นยืนยันตัวตน: ภาพประกอบ ข้อความ ช่องรหัสผ่าน และไม่มี stepper', () => {
    expect(component.step).toBe(0);
    expect(text('#email-change-title')).toBe('กรุณายืนยันตัวตนด้วยรหัสผ่านปัจจุบัน');
    expect(el.querySelector('img.acc-illus')).not.toBeNull();
    expect((el.querySelector('#ec-password') as HTMLInputElement).placeholder).toBe('ระบุรหัสผ่าน');
    expect(el.querySelector('app-stepper')).toBeNull();
    expect(el.querySelector('.acc-error.visible')).toBeNull();
  });

  it('รหัสผ่านว่าง: error ขึ้นหลังกดปุ่ม และไม่เรียก API', () => {
    component.submitPassword();
    fixture.detectChanges();
    expect(text('#ec-password-error')).toBe('กรุณากรอกรหัสผ่าน');
    expect(api.confirmPassword).not.toHaveBeenCalled();
  });

  it('รหัสผ่านผิด -> "รหัสผ่านไม่ถูกต้อง", ใกล้ครบกำหนดบอกจำนวนครั้งที่เหลือ, ครบแล้ว (429) บอกให้รอ', () => {
    component.passwordForm.setValue({ password: 'wrong' });
    api.confirmPassword.and.returnValue(throwError(() => error(400, 'WRONG_PASSWORD', 'รหัสผ่านไม่ถูกต้อง', { attemptsLeft: 4 })));
    component.submitPassword();
    fixture.detectChanges();
    expect(component.step).toBe(0);
    expect(text('#ec-password-error')).toBe('รหัสผ่านไม่ถูกต้อง');

    api.confirmPassword.and.returnValue(throwError(() => error(400, 'WRONG_PASSWORD', 'x', { attemptsLeft: 1 })));
    component.submitPassword();
    fixture.detectChanges();
    expect(text('#ec-password-error')).toBe('รหัสผ่านไม่ถูกต้อง (เหลืออีก 1 ครั้ง)');

    api.confirmPassword.and.returnValue(throwError(() => error(429, 'TOO_MANY_ATTEMPTS', 'ลองใหม่ใน 15 นาที')));
    component.submitPassword();
    fixture.detectChanges();
    expect(text('#ec-password-error')).toBe('ลองใหม่ใน 15 นาที');
  });

  it('กำลังตรวจสอบ: ปุ่มหมุนและกดซ้ำไม่ได้', () => {
    const pending = new Subject<StepToken>();
    api.confirmPassword.and.returnValue(pending);
    component.passwordForm.setValue({ password: 'Current!123' });
    component.submitPassword();
    component.submitPassword();
    fixture.detectChanges();
    expect(api.confirmPassword).toHaveBeenCalledTimes(1);
    const button = el.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.querySelector('.acc-spinner')).not.toBeNull();
  });

  it('"ลืมรหัสผ่าน?" -> สลับไป popup ลืมรหัสผ่าน (ไม่ซ้อน)', () => {
    (el.querySelector('.acc-forgot') as HTMLButtonElement).click();
    expect(authModal.switchTo).toHaveBeenCalledWith('forgot');
  });

  // ===== ขั้น 1 =====

  it('ยืนยันตัวตนผ่าน -> ขั้น 1 พร้อม stepper อยู่ที่ "อีเมลใหม่"', fakeAsync(() => {
    passIdentity();
    expect(component.step).toBe(1);
    expect(text('#email-change-title')).toBe('อีเมลของคุณ');
    expect(el.querySelector('app-stepper li.current')?.textContent).toContain('อีเมลใหม่');
    expect((el.querySelector('#ec-email') as HTMLInputElement).placeholder).toBe('example@example.com');
  }));

  it('อีเมลเดียวกับปัจจุบัน -> error โดยไม่เรียก API', fakeAsync(() => {
    passIdentity();
    component.emailForm.setValue({ email: 'OLD@example.com' });
    component.submitEmail();
    fixture.detectChanges();
    expect(text('#ec-email-error')).toBe('อีเมลนี้เป็นอีเมลปัจจุบันของคุณ');
    expect(api.requestEmailCode).not.toHaveBeenCalled();
  }));

  it('backend ตอบ SAME_EMAIL / EMAIL_TAKEN -> ข้อความตามกรณี', fakeAsync(() => {
    passIdentity();
    component.emailForm.setValue({ email: 'taken@example.com' });
    api.requestEmailCode.and.returnValue(throwError(() => error(409, 'EMAIL_TAKEN')));
    component.submitEmail();
    fixture.detectChanges();
    expect(api.requestEmailCode).toHaveBeenCalledWith('act-1', 'taken@example.com');
    expect(text('#ec-email-error')).toBe('อีเมลนี้ถูกใช้แล้ว');

    api.requestEmailCode.and.returnValue(throwError(() => error(400, 'SAME_EMAIL')));
    component.submitEmail();
    fixture.detectChanges();
    expect(text('#ec-email-error')).toBe('อีเมลนี้เป็นอีเมลปัจจุบันของคุณ');
    expect(component.step).toBe(1);
  }));

  it('หมดเวลายืนยันตัวตน -> กลับขั้น 0 พร้อมข้อความ', fakeAsync(() => {
    passIdentity();
    api.requestEmailCode.and.returnValue(throwError(() => error(400, 'INVALID_ACTION_TOKEN', 'หมดเวลายืนยันตัวตน')));
    component.emailForm.setValue({ email: 'new@example.com' });
    component.submitEmail();
    render();
    expect(component.step).toBe(0);
    expect(text('#ec-password-error')).toBe('หมดเวลายืนยันตัวตน');
  }));

  it('ยกเลิก -> ปิด popup', fakeAsync(() => {
    passIdentity();
    (el.querySelector('.acc-cancel') as HTMLButtonElement).click();
    expect(authModal.close).toHaveBeenCalled();
  }));

  // ===== ขั้น 2 =====

  it('ส่งรหัสแล้ว -> ขั้น 2 แสดงอีเมลใหม่ตัวหนา และนับถอยหลังส่งใหม่', fakeAsync(() => {
    goToCodeStep();
    expect(component.step).toBe(2);
    expect(text('.acc-email-strong')).toBe('new@example.com');
    expect(el.querySelectorAll('app-otp-input input').length).toBe(6);
    expect(text('.acc-resend-wait')).toBe('ส่งอีกครั้งได้ใน 1:00');
    tick(1000);
    fixture.detectChanges();
    expect(text('.acc-resend-wait')).toBe('ส่งอีกครั้งได้ใน 0:59');
    discardPeriodicTasks();
  }));

  it('"ย้อนกลับ" -> ขั้น 1 โดยอีเมลที่กรอกยังอยู่', fakeAsync(() => {
    goToCodeStep();
    (el.querySelector('.acc-back') as HTMLButtonElement).click();
    render();
    expect(component.step).toBe(1);
    expect((el.querySelector('#ec-email') as HTMLInputElement).value).toBe('new@example.com');
    discardPeriodicTasks();
  }));

  it('รหัสผิด / หมดอายุ -> ข้อความตามกรณี และล้างช่อง', fakeAsync(() => {
    goToCodeStep();
    api.confirmEmailChange.and.returnValue(throwError(() => error(400, 'INVALID_CODE')));
    component.onOtpCompleted('111111');
    fixture.detectChanges();
    expect(text('.acc-error.visible')).toBe('รหัสยืนยันไม่ถูกต้อง');
    expect(component.otpInvalid).toBeTrue();
    expect(component.otpValue).toBe('');

    api.confirmEmailChange.and.returnValue(throwError(() => error(400, 'CODE_EXPIRED')));
    component.onOtpCompleted('222222');
    fixture.detectChanges();
    expect(text('.acc-error.visible')).toBe('รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่');
    expect(component.step).toBe(2);
    discardPeriodicTasks();
  }));

  it('ส่งรหัสอีกครั้งหลังนับถอยหลังจบ', fakeAsync(() => {
    goToCodeStep();
    tick(60_000);
    fixture.detectChanges();
    api.requestEmailCode.calls.reset();
    api.requestEmailCode.and.returnValue(of(SENT));
    (el.querySelector('.acc-resend-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.requestEmailCode).toHaveBeenCalledWith('act-1', 'new@example.com');
    expect(text('.acc-error.visible')).toBe('ส่งรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้อีก');
    discardPeriodicTasks();
  }));

  // ===== ขั้น 3 =====

  it('รหัสถูก -> เสร็จสิ้น อัปเดตอีเมลหน้าโปรไฟล์ทันที ไม่มีปุ่มย้อนกลับ และ "เรียบร้อย" ปิด popup', fakeAsync(() => {
    goToCodeStep();
    api.confirmEmailChange.and.returnValue(of({ email: 'new@example.com' }));
    component.onOtpCompleted('123456');
    render();
    expect(api.confirmEmailChange).toHaveBeenCalledWith('act-1', '123456');
    expect(profiles.setEmail).toHaveBeenCalledWith('new@example.com');
    expect(component.step).toBe(3);
    expect(text('#email-change-title')).toBe('เรียบร้อย!!');
    expect(text('.acc-desc')).toBe('ทำการเปลี่ยนอีเมลของคุณเรียบร้อยแล้ว');
    expect(el.querySelector('.acc-back')).toBeNull();
    expect(el.querySelectorAll('app-stepper li.done').length).toBe(3);

    (el.querySelector('.acc-submit') as HTMLButtonElement).click();
    expect(authModal.close).toHaveBeenCalled();
  }));

  it('บัญชี Google ที่ยังไม่มีรหัสผ่าน: ไม่ถามรหัสผ่าน แต่พาไปตั้งรหัสผ่านก่อน', () => {
    Object.defineProperty(profiles, 'currentUser', { get: () => ({ username: 'g', email: 'g@example.com', avatarUrl: null, hasPassword: false }) });
    fixture.detectChanges();

    expect(text('#email-change-title')).toBe('กรุณาตั้งรหัสผ่านก่อนเปลี่ยนอีเมล');
    expect(el.querySelector('#ec-password')).toBeNull();
    const button = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'ตั้งรหัสผ่าน') as HTMLButtonElement;
    button.click();
    expect(authModal.switchTo).toHaveBeenCalledWith('password-change');
    expect(api.confirmPassword).not.toHaveBeenCalled();
  });
});
