import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UserMenuComponent } from './user-menu.component';
import { AuthService } from '../../services/authen/auth.service';

/** dropdown รูปโปรไฟล์: "ออกจากระบบ" ถามยืนยันก่อน (popup ตัวเดียวกับแผงเมนู ☰) */
describe('UserMenuComponent: ยืนยันก่อนออกจากระบบ', () => {
  let fixture: ComponentFixture<UserMenuComponent>;
  let el: HTMLElement;
  let logout: jasmine.Spy;

  const trigger = () => el.querySelector('.user-trigger') as HTMLButtonElement;
  const dialog = () => el.querySelector('app-logout-confirm [aria-modal="true"]') as HTMLElement | null;
  const button = (text: string) =>
    Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.trim() === text) as HTMLButtonElement;
  const flush = () => new Promise(r => setTimeout(r));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserMenuComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'isLoggedIn').and.returnValue(true);
    logout = spyOn(auth, 'logout');
    fixture = TestBed.createComponent(UserMenuComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();

    trigger().click();
    fixture.detectChanges();
    (el.querySelector('.dropdown .logout') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flush();
  });

  it('กดออกจากระบบใน dropdown -> ปิด dropdown แล้วแสดง popup ยืนยัน โฟกัสปุ่มยกเลิก', () => {
    expect(el.querySelector('.dropdown')).toBeNull();
    expect(dialog()!.getAttribute('role')).toBe('dialog');
    expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('ออกจากระบบ?');
    expect(document.activeElement).toBe(button('ยกเลิก'));
    expect(logout).not.toHaveBeenCalled();
  });

  it('กดยกเลิก -> ยังล็อกอินอยู่ (ไม่เรียก logout) และโฟกัสกลับปุ่มผู้ใช้', async () => {
    button('ยกเลิก').click();
    fixture.detectChanges();
    await flush();
    expect(dialog()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it('กด Esc -> ปิด popup ไม่ออกจากระบบ', () => {
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(dialog()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });

  it('กดยืนยัน -> เรียก AuthService.logout() ตัวเดิมครั้งเดียว', () => {
    button('ออกจากระบบ').click();
    fixture.detectChanges();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });
});
