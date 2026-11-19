import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { AVATAR_SIZE_ERROR, AVATAR_TYPE_ERROR, ProfileComponent, USERNAME_TAKEN } from './profile.component';
import { CurrentUser, UserProfileService } from '../../services/user-profile/user-profile.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';

const USER: CurrentUser = { username: 'alice', email: 'alice@example.com', avatarUrl: 'https://images.example.com/demo/a.jpg' };

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;
  let users: jasmine.SpyObj<UserProfileService>;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let user$: BehaviorSubject<CurrentUser | null>;
  let el: HTMLElement;

  const text = (selector: string) => el.querySelector(selector)?.textContent?.trim() ?? '';
  const render = () => { fixture.detectChanges(); tick(); fixture.detectChanges(); };

  function selectFile(file: File): void {
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function fileOf(type: string, bytes: number): File {
    return new File([new Uint8Array(bytes)], 'avatar', { type });
  }

  function usernameInput(): HTMLInputElement {
    return el.querySelector('#profile-username') as HTMLInputElement;
  }

  function typeUsername(value: string, key?: string): void {
    const input = usernameInput();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    if (key) input.dispatchEvent(new KeyboardEvent('keydown', { key }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    user$ = new BehaviorSubject<CurrentUser | null>(USER);
    users = jasmine.createSpyObj<UserProfileService>('UserProfileService', ['loadCurrentUser', 'uploadAvatar', 'changeUsername'],
      { currentUser$: user$.asObservable() });
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['open']);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    spyOn(URL, 'revokeObjectURL');
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [{ provide: UserProfileService, useValue: users }, { provide: AuthModalService, useValue: authModal },
        provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('แสดงรูป ชื่อ อีเมล และรหัสผ่านเป็นจุด (ไม่มีรหัสจริง)', () => {
    expect((el.querySelector('.avatar img') as HTMLImageElement).src).toBe(USER.avatarUrl!);
    expect(el.querySelector('.avatar-edit')?.getAttribute('aria-label')).toBe('เปลี่ยนรูปโปรไฟล์');
    const boxes = Array.from(el.querySelectorAll('.field-box')).map(b => b.textContent?.trim());
    expect(boxes[0]).toBe('alice');
    expect(boxes[1]).toBe('alice@example.com');
    expect(boxes[2]).toContain('●●●●●●●●');
    expect(text('.change-password')).toBe('Change Password');
  });

  it('ยังไม่มีรูป -> รูปเริ่มต้น', () => {
    user$.next({ ...USER, avatarUrl: null });
    fixture.detectChanges();
    expect((el.querySelector('.avatar img') as HTMLImageElement).src).toContain('images/default-avatar.svg');
  });

  // ===== รูปโปรไฟล์ =====

  it('ปุ่มดินสอเปิดตัวเลือกไฟล์ (รับเฉพาะ JPG/PNG/WebP)', () => {
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    const click = spyOn(input, 'click');
    (el.querySelector('.avatar-edit') as HTMLButtonElement).click();
    expect(click).toHaveBeenCalled();
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
  });

  it('ไฟล์ผิดชนิด / ใหญ่เกิน 5MB -> ข้อความภาษาไทย ไม่พรีวิว ไม่อัปโหลด', () => {
    selectFile(fileOf('image/gif', 10));
    expect(text('#avatar-error')).toBe(AVATAR_TYPE_ERROR);
    expect(component.hasPreview).toBeFalse();

    selectFile(fileOf('image/png', 5 * 1024 * 1024 + 1));
    expect(text('#avatar-error')).toBe(AVATAR_SIZE_ERROR);
    expect(component.hasPreview).toBeFalse();
    expect(users.uploadAvatar).not.toHaveBeenCalled();
  });

  it('ไฟล์ถูกต้อง -> พรีวิววงกลมพร้อม บันทึก/ยกเลิก; ยกเลิกกลับรูปเดิม', () => {
    selectFile(fileOf('image/webp', 1024));
    expect((el.querySelector('.avatar img') as HTMLImageElement).src).toBe('blob:preview');
    expect(el.querySelector('.avatar-preview')).not.toBeNull();
    expect(el.querySelector('.avatar-edit')).toBeNull();

    const cancel = Array.from(el.querySelectorAll('.avatar-actions button')).find(b => b.textContent?.includes('ยกเลิก')) as HTMLButtonElement;
    cancel.click();
    fixture.detectChanges();
    expect((el.querySelector('.avatar img') as HTMLImageElement).src).toBe(USER.avatarUrl!);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(users.uploadAvatar).not.toHaveBeenCalled();
  });

  it('บันทึก -> อัปโหลด (ปุ่มกดซ้ำไม่ได้ระหว่างรอ) แล้วแสดงรูปใหม่จาก service (navbar ใช้ค่าเดียวกัน)', () => {
    const pending = new Subject<{ avatarUrl: string }>();
    users.uploadAvatar.and.returnValue(pending);
    const file = fileOf('image/jpeg', 2048);
    selectFile(file);
    component.saveAvatar();
    component.saveAvatar();
    fixture.detectChanges();
    expect(users.uploadAvatar).toHaveBeenCalledOnceWith(file);
    expect((el.querySelector('.avatar-actions .btn-primary') as HTMLButtonElement).disabled).toBeTrue();

    pending.next({ avatarUrl: 'https://images.example.com/demo/new.jpg' });
    user$.next({ ...USER, avatarUrl: 'https://images.example.com/demo/new.jpg' });
    pending.complete();
    fixture.detectChanges();
    expect(component.hasPreview).toBeFalse();
    expect((el.querySelector('.avatar img') as HTMLImageElement).src).toBe('https://images.example.com/demo/new.jpg');
  });

  it('อัปโหลดไม่สำเร็จ -> แสดงข้อความจาก backend และยังพรีวิวอยู่ให้ลองใหม่', () => {
    users.uploadAvatar.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { message: 'รองรับเฉพาะไฟล์รูป JPG, PNG, WebP ขนาดไม่เกิน 5 MB' }
    })));
    selectFile(fileOf('image/png', 100));
    component.saveAvatar();
    fixture.detectChanges();
    expect(text('#avatar-error')).toBe('รองรับเฉพาะไฟล์รูป JPG, PNG, WebP ขนาดไม่เกิน 5 MB');
    expect(component.hasPreview).toBeTrue();
  });

  // ===== UserName =====

  it('"แก้ไข" -> ช่องกรอกพร้อมชื่อเดิม, Esc ยกเลิกโดยไม่บันทึก', fakeAsync(() => {
    (el.querySelector('.edit-btn') as HTMLButtonElement).click();
    render();
    expect(usernameInput().value).toBe('alice');
    expect(document.activeElement).toBe(usernameInput());

    typeUsername('bobby', 'Escape');
    render();
    expect(component.editingUsername).toBeFalse();
    expect(el.querySelector('.field-box')?.textContent?.trim()).toBe('alice');
    expect(users.changeUsername).not.toHaveBeenCalled();
  }));

  it('Enter บันทึก -> ชื่อใหม่ขึ้นทันที (ผ่าน service ที่ navbar ใช้)', fakeAsync(() => {
    users.changeUsername.and.callFake(name => {
      user$.next({ ...USER, username: name });
      return of({ ...USER, username: name });
    });
    component.startEditUsername();
    render();
    typeUsername('  bobby  ', 'Enter');
    render();
    expect(users.changeUsername).toHaveBeenCalledWith('bobby');
    expect(component.editingUsername).toBeFalse();
    expect(el.querySelector('.field-box')?.textContent?.trim()).toBe('bobby');
  }));

  it('ชื่อผิดกฎ -> error ตามกฎสมัคร ไม่เรียก API; ชื่อซ้ำ -> "ชื่อผู้ใช้นี้ถูกใช้แล้ว" ใต้ช่อง', fakeAsync(() => {
    component.startEditUsername();
    render();
    typeUsername('ab', 'Enter');
    expect(text('#profile-username-error')).toBe('ชื่อผู้ใช้ต้องมี 3-50 ตัวอักษร');
    typeUsername('bad name', 'Enter');
    expect(text('#profile-username-error')).toBe('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, A-Z และ 0-9');
    expect(users.changeUsername).not.toHaveBeenCalled();

    users.changeUsername.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { code: 'USERNAME_TAKEN', message: 'x' }
    })));
    typeUsername('bobby', 'Enter');
    expect(text('#profile-username-error')).toBe(USERNAME_TAKEN);
    expect(component.editingUsername).toBeTrue();
  }));

  it('ชื่อเดิม -> ปิดช่องแก้โดยไม่เรียก API', fakeAsync(() => {
    component.startEditUsername();
    render();
    typeUsername('alice', 'Enter');
    expect(users.changeUsername).not.toHaveBeenCalled();
    expect(component.editingUsername).toBeFalse();
  }));

  // ===== Email / Password =====

  it('"แก้ไข" ของ Email เปิด popup แก้ไขอีเมล, "Change Password" เปิด popup เปลี่ยนรหัสผ่าน', () => {
    (el.querySelectorAll('.edit-btn')[1] as HTMLButtonElement).click();
    expect(authModal.open).toHaveBeenCalledWith('email-change');
    (el.querySelector('.change-password') as HTMLButtonElement).click();
    expect(authModal.open).toHaveBeenCalledWith('password-change');
  });

  it('โซนลบบัญชีอยู่ล่างสุดของหน้า; บัญชี Google ที่ไม่มีรหัสผ่านใช้รหัสทางอีเมล', () => {
    const main = el.querySelector('main')!;
    const danger = main.querySelector('app-delete-account')!;
    expect(danger).not.toBeNull();
    expect(main.lastElementChild).toBe(danger);
    expect(danger.querySelector('.danger-btn')?.textContent).toContain('ลบบัญชี');

    user$.next({ ...USER, hasPassword: false });
    fixture.detectChanges();
    (el.querySelector('.danger-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('#delete-code')).not.toBeNull();
    expect(el.querySelector('#delete-password')).toBeNull();
  });
});
