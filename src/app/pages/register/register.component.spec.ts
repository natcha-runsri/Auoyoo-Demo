import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';

import { RegisterComponent } from './register.component';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';

const VALID = { email: 'new@example.com', username: 'newuser1', password: 'Passw0rd!x', confirmPassword: 'Passw0rd!x', rememberMe: true };

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let auth: jasmine.SpyObj<AuthService>;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let el: HTMLElement;

  const errorText = (field: string) => el.querySelector(`#register-${field}-error`)?.textContent?.trim() ?? '';

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['register']);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['switchTo']);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [{ provide: AuthService, useValue: auth }, { provide: AuthModalService, useValue: authModal }]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('ช่องเรียง Email, Username, Password, Confirm Password และ label ผูกกับ input', () => {
    const ids = Array.from(el.querySelectorAll('input:not([type=checkbox])')).map(i => i.id);
    expect(ids).toEqual(['register-email', 'register-username', 'register-password', 'register-confirmPassword']);
    for (const id of ids) {
      expect(el.querySelector(`label[for="${id}"]`)).withContext(id).toBeTruthy();
    }
  });

  it('เพิ่งเปิด popup / คลิกหรือ Tab ผ่านช่อง (ยังไม่กด Register) -> ไม่แสดง error', () => {
    expect(errorText('email')).toBe('');

    for (const id of ['email', 'username', 'password', 'confirmPassword']) {
      const input = el.querySelector(`#register-${id}`) as HTMLInputElement;
      input.dispatchEvent(new Event('focus'));
      input.dispatchEvent(new Event('blur'));
    }
    component.form.patchValue({ email: 'bad' }); // พิมพ์ผิดแล้วออกจากช่องก็ยังไม่แดงจนกว่าจะกด Register
    fixture.detectChanges();

    expect(el.querySelectorAll('.field-error.visible').length).toBe(0);
  });

  it('submit ฟอร์ม -> ไม่ submit แบบ native (หน้าไม่โหลดใหม่)', () => {
    const submit = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBeTrue();
  });

  it('กด Register ฟอร์มว่าง -> error ภาษาไทยทุกช่อง และไม่เรียก API', () => {
    component.onRegister();
    fixture.detectChanges();

    expect(auth.register).not.toHaveBeenCalled();
    expect(errorText('email')).toBe('กรุณากรอกอีเมล');
    expect(errorText('username')).toBe('กรุณากรอกชื่อผู้ใช้');
    expect(errorText('password')).toBe('กรุณากรอกรหัสผ่าน');
    expect(errorText('confirmPassword')).toBe('กรุณายืนยันรหัสผ่าน');
  });

  it('ตรวจตามกฎ backend: อีเมลผิดรูป, username สั้น/มีอักขระพิเศษ, รหัสผ่านแจ้งข้อแรกที่ไม่ผ่านแบบบรรทัดเดียว', () => {
    component.form.patchValue({ email: 'not-an-email', username: 'a_', password: 'weakpassword' });
    component.onRegister();
    fixture.detectChanges();

    expect(errorText('email')).toBe('รูปแบบอีเมลไม่ถูกต้อง');
    expect(errorText('username')).toContain('3-50');
    expect(errorText('password')).toBe('รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว');

    component.form.patchValue({ username: 'bad_name' });
    fixture.detectChanges();
    expect(errorText('username')).toContain('a-z, A-Z');
  });

  it('หลังกด Register แล้ว แก้ช่องไหนถูก error ช่องนั้นหายทันที (ช่องอื่นยังแสดงอยู่)', () => {
    component.onRegister();
    fixture.detectChanges();
    expect(errorText('email')).toBe('กรุณากรอกอีเมล');

    component.form.controls.email.setValue('ok@example.com');
    fixture.detectChanges();
    expect(errorText('email')).toBe('');
    expect(errorText('username')).toBe('กรุณากรอกชื่อผู้ใช้');
  });

  it('checklist กฎรหัสผ่านแสดงเฉพาะตอน focus ช่อง Password', () => {
    const rules = el.querySelector('.password-rules') as HTMLElement;
    const input = el.querySelector('#register-password') as HTMLInputElement;
    expect(rules.classList).not.toContain('open');

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(rules.classList).toContain('open');

    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(rules.classList).not.toContain('open');
  });

  it('คำแนะนำกฎรหัสผ่านขึ้น ✓ ทีละข้อเมื่อผ่าน', () => {
    component.form.patchValue({ password: 'abcdefghi' });
    fixture.detectChanges();
    const met = el.querySelectorAll('.password-rules li.met').length;
    expect(met).toBe(3); // ความยาว, ตัวพิมพ์เล็ก, อักขระที่อนุญาต

    component.form.patchValue({ password: 'Abcdefgh!' });
    fixture.detectChanges();
    expect(el.querySelectorAll('.password-rules li.met').length).toBe(5);
  });

  it('รหัสผ่านไม่ตรงกัน -> แสดง "รหัสผ่านไม่ตรงกัน" และไม่เรียก API', () => {
    component.form.setValue({ ...VALID, confirmPassword: 'Different1!' });
    component.onRegister();
    fixture.detectChanges();

    expect(errorText('confirmPassword')).toBe('รหัสผ่านไม่ตรงกัน');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('สมัครสำเร็จ -> ส่งข้อมูล + rememberMe แล้ว emit registerSuccess (host ปิด popup)', () => {
    auth.register.and.returnValue(of({ token: 't', username: 'newuser1', fullName: 'newuser1' }));
    const done = jasmine.createSpy('registerSuccess');
    component.registerSuccess.subscribe(done);
    component.form.setValue(VALID);

    component.onRegister();

    // ไม่ส่ง fullName (ดีไซน์ไม่มีช่องนี้)
    expect(auth.register).toHaveBeenCalledOnceWith('newuser1', 'new@example.com', 'Passw0rd!x', true);
    expect(done).toHaveBeenCalled();
  });

  it('ระหว่างรอ API ปุ่ม disabled และกดซ้ำไม่ยิงซ้ำ', () => {
    auth.register.and.returnValue(new Subject<never>());
    component.form.setValue(VALID);

    component.onRegister();
    component.onRegister();
    fixture.detectChanges();

    expect(auth.register).toHaveBeenCalledTimes(1);
    expect((el.querySelector('.register-submit') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('409 อีเมลซ้ำ -> error ใต้ช่อง Email โดยไม่ล้างข้อมูล และหายเมื่อแก้ค่า', fakeAsync(() => {
    const result = new Subject<never>();
    auth.register.and.returnValue(result);
    component.form.setValue(VALID);

    component.onRegister();
    result.error(new HttpErrorResponse({ status: 409, error: { field: 'email', message: 'x' } }));
    fixture.detectChanges();
    tick();

    expect(errorText('email')).toBe('อีเมลนี้ถูกใช้แล้ว');
    expect(component.form.getRawValue()).toEqual(VALID);
    expect(el.querySelector('[role="alert"]')).toBeNull();

    component.form.controls.email.setValue('another@example.com');
    fixture.detectChanges();
    expect(errorText('email')).toBe('');
  }));

  it('409 username ซ้ำ -> error ใต้ช่อง Username', fakeAsync(() => {
    const result = new Subject<never>();
    auth.register.and.returnValue(result);
    component.form.setValue(VALID);

    component.onRegister();
    result.error(new HttpErrorResponse({ status: 409, error: { field: 'username', message: 'x' } }));
    fixture.detectChanges();
    tick();

    expect(errorText('username')).toBe('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
    expect(component.form.controls.username.value).toBe('newuser1');
  }));

  it('error อื่น -> ข้อความรวมในกล่อง', () => {
    const result = new Subject<never>();
    auth.register.and.returnValue(result);
    component.form.setValue(VALID);

    component.onRegister();
    result.error(new HttpErrorResponse({ status: 500 }));
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('สมัครสมาชิกไม่สำเร็จ');
  });

  it('Back to Login -> สลับไป login ใน modal เดิม พร้อม username ที่กรอกไว้', () => {
    component.form.patchValue({ username: 'newuser1', password: 'secret' });
    component.onBackToLogin();
    expect(authModal.switchTo).toHaveBeenCalledWith('login', { username: 'newuser1' });
  });
});
