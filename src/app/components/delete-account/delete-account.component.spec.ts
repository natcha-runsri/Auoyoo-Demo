import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { Subject, TimeoutError, of, throwError } from 'rxjs';

import { ACCOUNT_DELETED_MESSAGE, DeleteAccountComponent } from './delete-account.component';
import { AccountService } from '../../services/account/account.service';
import { AuthService } from '../../services/authen/auth.service';
import { CompareService } from '../../services/compare/compare.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';
import { FlashMessageService } from '../flash-message/flash-message.component';

describe('DeleteAccountComponent', () => {
  let fixture: ComponentFixture<DeleteAccountComponent>;
  let el: HTMLElement;
  let account: jasmine.SpyObj<AccountService>;
  let auth: jasmine.SpyObj<AuthService>;
  let compare: jasmine.SpyObj<CompareService>;
  let profiles: jasmine.SpyObj<UserProfileService>;
  let flash: FlashMessageService;
  let router: Router;

  const dialog = () => el.querySelector('[aria-modal="true"]') as HTMLElement | null;
  const confirmButton = () => el.querySelector('.btn-danger') as HTMLButtonElement;
  const errorText = () => el.querySelector('.error')?.textContent?.trim() ?? '';
  /** รอ navigate().then(...) ให้จบ */
  const settle = () => new Promise(r => setTimeout(r));

  function type(id: string, value: string): void {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function create(hasPassword: boolean): void {
    fixture = TestBed.createComponent(DeleteAccountComponent);
    fixture.componentRef.setInput('email', 'me@example.com');
    fixture.componentRef.setInput('hasPassword', hasPassword);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  function openDialog(): void {
    (el.querySelector('.danger-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    account = jasmine.createSpyObj<AccountService>('AccountService', ['deleteAccount', 'requestDeleteCode']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['endSessionAfterAccountDeleted']);
    compare = jasmine.createSpyObj<CompareService>('CompareService', ['clear']);
    profiles = jasmine.createSpyObj<UserProfileService>('UserProfileService', ['clear']);
    await TestBed.configureTestingModule({
      imports: [DeleteAccountComponent],
      providers: [provideRouter([]),
        { provide: AccountService, useValue: account }, { provide: AuthService, useValue: auth },
        { provide: CompareService, useValue: compare }, { provide: UserProfileService, useValue: profiles }]
    }).compileComponents();
    flash = TestBed.inject(FlashMessageService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => flash.dismiss());

  it('โซนอันตรายบอกว่าจะลบอะไร ปุ่มสีแดง และยังไม่เปิด dialog', () => {
    create(true);
    expect(el.querySelector('#danger-zone-title')?.textContent?.trim()).toBe('ลบบัญชี');
    expect(el.querySelector('.danger-desc')?.textContent).toContain('ย้อนกลับไม่ได้');
    expect(getComputedStyle(el.querySelector('.danger-btn')!).backgroundColor).toBe('rgb(229, 52, 59)');
    expect(dialog()).toBeNull();
  });

  it('ConfirmDialog ตัวเดิม: อธิบายว่าจะลบอะไร กู้คืนไม่ได้ — ปุ่มยืนยันกดได้เมื่อพิมพ์ "ลบบัญชี" และกรอกรหัสผ่านแล้ว', () => {
    create(true);
    openDialog();
    expect(el.querySelector('app-confirm-dialog')).not.toBeNull();
    expect(dialog()!.getAttribute('role')).toBe('alertdialog');
    expect(el.querySelector('#confirm-desc')?.textContent).toContain('กู้คืนไม่ได้');
    expect(document.activeElement).toBe(el.querySelector('#delete-confirm-word'));
    expect(confirmButton().disabled).toBeTrue();

    type('delete-confirm-word', 'ลบ');
    type('delete-password', 'secret');
    expect(confirmButton().disabled).toBeTrue();
    type('delete-confirm-word', 'ลบบัญชี');
    expect(confirmButton().disabled).toBeFalse();
    expect(el.querySelector('#delete-code')).toBeNull();
  });

  it('ลบสำเร็จ: ส่งคำยืนยัน+รหัสผ่าน แล้วออกจากระบบ ล้างรายการเปรียบเทียบ กลับหน้าแรก และแจ้งว่าลบเรียบร้อย', async () => {
    create(true);
    account.deleteAccount.and.returnValue(of(undefined));
    openDialog();
    type('delete-confirm-word', 'ลบบัญชี');
    type('delete-password', 'secret');

    confirmButton().click();
    await settle(); // ไม่ใช้ whenStable: flash message / นับถอยหลังมี timer ยาว
    fixture.detectChanges();

    expect(account.deleteAccount).toHaveBeenCalledOnceWith({ confirmation: 'ลบบัญชี', password: 'secret' });
    expect(auth.endSessionAfterAccountDeleted).toHaveBeenCalled();
    expect(profiles.clear).toHaveBeenCalled();
    expect(compare.clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(flash.message()).toBe(ACCOUNT_DELETED_MESSAGE);
    expect(dialog()).toBeNull();
  });

  it('ระหว่างลบ: ปุ่มแสดงสถานะ และปิด dialog/แก้ช่องไม่ได้', () => {
    create(true);
    account.deleteAccount.and.returnValue(new Subject<void>());
    openDialog();
    type('delete-confirm-word', 'ลบบัญชี');
    type('delete-password', 'secret');
    confirmButton().click();
    fixture.detectChanges();

    expect(confirmButton().textContent).toContain('กำลังลบบัญชี...');
    expect((el.querySelector('#delete-password') as HTMLInputElement).disabled).toBeTrue();
    (el.querySelector('.overlay') as HTMLElement).click();
    fixture.detectChanges();
    expect(dialog()).not.toBeNull();
  });

  it('รหัสผ่านผิด: ข้อความภาษาไทยพร้อมจำนวนครั้งที่เหลือ ไม่ออกจากระบบ และล้างช่องรหัสผ่านให้กรอกใหม่', () => {
    create(true);
    account.deleteAccount.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { code: 'WRONG_PASSWORD', message: 'รหัสผ่านไม่ถูกต้อง', attemptsLeft: 3 } })));
    openDialog();
    type('delete-confirm-word', 'ลบบัญชี');
    type('delete-password', 'wrong');
    confirmButton().click();
    fixture.detectChanges();

    expect(errorText()).toBe('รหัสผ่านไม่ถูกต้อง (เหลืออีก 3 ครั้ง)');
    expect(auth.endSessionAfterAccountDeleted).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect((el.querySelector('#delete-password') as HTMLInputElement).value).toBe('');
    expect(dialog()).not.toBeNull();
  });

  it('หมดเวลา / ต่อเซิร์ฟเวอร์ไม่ได้ / เซิร์ฟเวอร์ error -> ข้อความภาษาไทย', () => {
    create(true);
    openDialog();
    const cases: [unknown, string][] = [
      [new TimeoutError(), 'เซิร์ฟเวอร์ไม่ตอบกลับภายในเวลาที่กำหนด'],
      [new HttpErrorResponse({ status: 0 }), 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ บัญชียังไม่ถูกลบ'],
      [new HttpErrorResponse({ status: 500, error: { message: 'stack trace' } }), 'ลบบัญชีไม่สำเร็จ บัญชียังไม่ถูกลบ']
    ];
    for (const [error, expected] of cases) {
      account.deleteAccount.and.returnValue(throwError(() => error));
      type('delete-confirm-word', 'ลบบัญชี');
      type('delete-password', 'secret');
      confirmButton().click();
      fixture.detectChanges();
      expect(errorText()).toContain(expected);
    }
    expect(auth.endSessionAfterAccountDeleted).not.toHaveBeenCalled();
  });

  it('บัญชี Google (ไม่มีรหัสผ่าน): ขอรหัสทางอีเมล แล้วยืนยันด้วยรหัส 6 หลัก', async () => {
    create(false);
    account.requestDeleteCode.and.returnValue(of({ sentTo: 'me@example.com', expiresInSeconds: 300, resendAfterSeconds: 60 }));
    account.deleteAccount.and.returnValue(of(undefined));
    openDialog();
    expect(el.querySelector('#delete-password')).toBeNull();
    expect(el.querySelector('.field-hint')?.textContent).toContain('me@example.com');

    (el.querySelector('.send-code') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(account.requestDeleteCode).toHaveBeenCalled();
    expect(el.querySelector('.field-hint.sent')?.textContent).toContain('me@example.com');
    expect((el.querySelector('.send-code') as HTMLButtonElement).disabled).toBeTrue(); // นับถอยหลังก่อนส่งซ้ำ

    type('delete-confirm-word', 'ลบบัญชี');
    type('delete-code', '12 34-5');
    expect(confirmButton().disabled).toBeTrue();
    type('delete-code', '123456');
    expect(confirmButton().disabled).toBeFalse();
    confirmButton().click();
    await settle(); // ไม่ใช้ whenStable: flash message / นับถอยหลังมี timer ยาว

    expect(account.deleteAccount).toHaveBeenCalledOnceWith({ confirmation: 'ลบบัญชี', code: '123456' });
    expect(auth.endSessionAfterAccountDeleted).toHaveBeenCalled();
    fixture.componentInstance.ngOnDestroy();
  });

  it('ยกเลิก -> ปิด dialog ไม่เรียก API', () => {
    create(true);
    openDialog();
    (Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'ยกเลิก') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialog()).toBeNull();
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });
});
