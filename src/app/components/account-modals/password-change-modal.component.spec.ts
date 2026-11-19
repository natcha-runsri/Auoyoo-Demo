import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { PasswordChangeModalComponent } from './password-change-modal.component';
import { AccountService } from '../../services/account/account.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';

const SENT = { sentTo: 'me@example.com', expiresInSeconds: 300, resendAfterSeconds: 60 };

describe('PasswordChangeModalComponent', () => {
  let fixture: ComponentFixture<PasswordChangeModalComponent>;
  let component: PasswordChangeModalComponent;
  let api: jasmine.SpyObj<AccountService>;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let el: HTMLElement;

  const text = (selector: string) => el.querySelector(selector)?.textContent?.trim() ?? '';
  const render = () => { fixture.detectChanges(); tick(); fixture.detectChanges(); };
  const error = (status: number, code: string, message = 'x') => new HttpErrorResponse({ status, error: { code, message } });

  function goToCodeStep(): void {
    api.requestPasswordCode.and.returnValue(of(SENT));
    component.sendCode();
    render();
  }

  function goToPasswordStep(): void {
    goToCodeStep();
    api.verifyPasswordCode.and.returnValue(of({ token: 'reset-1', expiresInSeconds: 600 }));
    component.onOtpCompleted('123456');
    render();
  }

  function fillPasswords(newPassword: string, confirm = newPassword): void {
    component.passwordForm.setValue({ newPassword, confirmPassword: confirm });
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<AccountService>('AccountService', ['requestPasswordCode', 'verifyPasswordCode', 'changePassword']);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['switchTo', 'close']);
    const profiles = jasmine.createSpyObj<UserProfileService>('UserProfileService', [],
      { currentUser: { username: 'alice', email: 'me@example.com', avatarUrl: null } });
    await TestBed.configureTestingModule({
      imports: [PasswordChangeModalComponent],
      providers: [
        { provide: AccountService, useValue: api },
        { provide: AuthModalService, useValue: authModal },
        { provide: UserProfileService, useValue: profiles }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(PasswordChangeModalComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('ขั้น 1: หัวข้อ "เปลี่ยนรหัสผ่าน" แสดงอีเมลปัจจุบันแบบแก้ไม่ได้ และ stepper อยู่ขั้นแรก', () => {
    expect(text('#password-change-title')).toBe('เปลี่ยนรหัสผ่าน');
    const email = el.querySelector('#pc-email') as HTMLInputElement;
    expect(email.value).toBe('me@example.com');
    expect(email.readOnly).toBeTrue();
    expect(el.querySelector('app-stepper li.current')?.textContent).toContain('อีเมล');
    expect(text('button[type=submit]')).toBe('ส่งรหัสผ่าน');
  });

  it('กดปุ่มส่งในฟอร์มที่ไม่มี formGroup -> ไม่ submit แบบ native (หน้าไม่โหลดใหม่)', fakeAsync(() => {
    api.requestPasswordCode.and.returnValue(of(SENT));
    const submit = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBeTrue();
    expect(api.requestPasswordCode).toHaveBeenCalledTimes(1);
    render();

    api.verifyPasswordCode.and.returnValue(of({ token: 'reset-1', expiresInSeconds: 600 }));
    const codeSubmit = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(codeSubmit);
    expect(codeSubmit.defaultPrevented).toBeTrue();
    fixture.detectChanges();
    expect(text('.acc-error.visible')).toBe('กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก');
    discardPeriodicTasks();
  }));

  it('ขั้น 1 -> 2: ส่งรหัสไปอีเมลปัจจุบัน', fakeAsync(() => {
    goToCodeStep();
    expect(api.requestPasswordCode).toHaveBeenCalledTimes(1);
    expect(component.step).toBe(2);
    expect(text('.acc-email-strong')).toBe('me@example.com');
    discardPeriodicTasks();
  }));

  it('ขอรหัสถี่เกิน (429) ครั้งแรก -> แสดงข้อความ อยู่ขั้นเดิม', () => {
    api.requestPasswordCode.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 429, error: { message: 'ขอรหัสบ่อยเกินไป' }, headers: new HttpHeaders({ 'Retry-After': '30' })
    })));
    component.sendCode();
    fixture.detectChanges();
    expect(component.step).toBe(1);
    expect(text('.acc-error.visible')).toBe('ขอรหัสบ่อยเกินไป');
  });

  it('รหัสผิด -> "รหัสยืนยันไม่ถูกต้อง" อยู่ขั้น 2', fakeAsync(() => {
    goToCodeStep();
    api.verifyPasswordCode.and.returnValue(throwError(() => error(400, 'INVALID_CODE')));
    component.onOtpCompleted('000000');
    fixture.detectChanges();
    expect(component.step).toBe(2);
    expect(text('.acc-error.visible')).toBe('รหัสยืนยันไม่ถูกต้อง');
    discardPeriodicTasks();
  }));

  it('ย้อนกลับจากขั้น 2 -> ขั้น 1', fakeAsync(() => {
    goToCodeStep();
    (el.querySelector('.acc-back') as HTMLButtonElement).click();
    render();
    expect(component.step).toBe(1);
    discardPeriodicTasks();
  }));

  it('ขั้น 3: กฎรหัสผ่านเหมือนสมัคร และต้องตรงกับช่องยืนยัน (error ขึ้นหลังกดปุ่ม)', fakeAsync(() => {
    goToPasswordStep();
    expect(component.step).toBe(3);
    fillPasswords('short');
    fixture.detectChanges();
    expect(el.querySelector('.acc-error.visible')).toBeNull();

    component.submitPassword();
    fixture.detectChanges();
    expect(text('#pc-new-password-error')).toBe('รหัสผ่านต้องมี 9-72 ตัวอักษร');

    fillPasswords('NewPass!123', 'NewPass!124');
    component.submitPassword();
    fixture.detectChanges();
    expect(text('#pc-confirm-password-error')).toBe('รหัสผ่านไม่ตรงกัน');
    expect(api.changePassword).not.toHaveBeenCalled();
  }));

  it('รหัสใหม่ซ้ำรหัสเดิม -> แจ้งใต้ช่องรหัสผ่านใหม่', fakeAsync(() => {
    goToPasswordStep();
    api.changePassword.and.returnValue(throwError(() => error(400, 'SAME_PASSWORD')));
    fillPasswords('OldPass!123');
    component.submitPassword();
    fixture.detectChanges();
    expect(text('#pc-new-password-error')).toBe('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    expect(component.step).toBe(3);
  }));

  it('token หมดอายุ -> ปุ่ม "ขอรหัสใหม่" กลับขั้น 1', fakeAsync(() => {
    goToPasswordStep();
    api.changePassword.and.returnValue(throwError(() => error(400, 'INVALID_RESET_TOKEN', 'คำขอเปลี่ยนรหัสผ่านหมดอายุแล้ว กรุณาเริ่มใหม่')));
    fillPasswords('NewPass!123');
    component.submitPassword();
    fixture.detectChanges();
    expect(text('#pc-confirm-password-error')).toBe('คำขอเปลี่ยนรหัสผ่านหมดอายุแล้ว กรุณาเริ่มใหม่');
    (el.querySelector('.acc-submit') as HTMLButtonElement).click();
    render();
    expect(component.step).toBe(1);
  }));

  it('สำเร็จ -> ส่ง reset token + รหัสใหม่ แสดงข้อความสำเร็จ และ "เรียบร้อย" ปิด popup (ไม่ออกจากระบบ)', fakeAsync(() => {
    goToPasswordStep();
    api.changePassword.and.returnValue(of({ token: 'new-access', username: 'alice', fullName: null }));
    fillPasswords('NewPass!123');
    component.submitPassword();
    render();
    expect(api.changePassword).toHaveBeenCalledWith('reset-1', 'NewPass!123');
    expect(component.step).toBe(4);
    expect(text('#password-change-title')).toBe('เรียบร้อย!!');
    expect(text('.acc-desc')).toContain('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    expect(el.querySelectorAll('app-stepper li.done').length).toBe(3);

    (el.querySelector('.acc-submit') as HTMLButtonElement).click();
    expect(authModal.close).toHaveBeenCalled();
    expect(authModal.switchTo).not.toHaveBeenCalled();
  }));
});
