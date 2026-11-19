import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { DrawerMenuComponent } from './drawer-menu.component';
import { AuthService } from '../../services/authen/auth.service';

@Component({ standalone: true, template: '<p>page</p>' })
class PageStubComponent {}

/** ปุ่ม ☰ จำลอง ต่อกับแผงแบบเดียวกับ app.component.html */
@Component({
  standalone: true,
  imports: [DrawerMenuComponent],
  template: `
    <button #trigger type="button" class="trigger" (click)="open = true">☰</button>
    <app-drawer-menu [(open)]="open" [returnFocusTo]="trigger"></app-drawer-menu>
  `
})
class HostComponent {
  open = false;
}

/** แผงเมนู ☰ (จอเล็กกว่า 1024px): เปิด/ปิดด้วย X, คลิกนอกแผง, Esc, ปิดเองเมื่อเลือกเมนู + เมนูบัญชี + ยืนยันออกจากระบบ */
describe('DrawerMenuComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;
  let router: Router;
  let auth: AuthService;

  const trigger = () => el.querySelector('.trigger') as HTMLButtonElement;
  const drawer = () => el.querySelector('#site-drawer') as HTMLElement;
  const isOpen = () => drawer().classList.contains('open');
  const flush = () => new Promise(r => setTimeout(r));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(),
        provideRouter([{ path: '', component: PageStubComponent }, { path: 'category', component: PageStubComponent },
          { path: 'recommendations', component: PageStubComponent }, { path: 'profile', component: PageStubComponent },
          { path: 'history', component: PageStubComponent }, { path: 'login', component: PageStubComponent }])]
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    el = fixture.nativeElement;
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    await router.navigateByUrl('/');
    fixture.detectChanges();
  });

  afterEach(() => document.body.classList.remove('drawer-open'));

  function open(): void {
    trigger().click();
    fixture.detectChanges();
  }

  it('ปิดอยู่ตอนแรก: ซ่อนจาก screen reader และกดไม่ได้ (inert)', () => {
    expect(isOpen()).toBeFalse();
    expect(drawer().getAttribute('aria-hidden')).toBe('true');
    expect(drawer().hasAttribute('inert')).toBeTrue();
  });

  it('เปิด -> มี หน้าหลัก / หมวดหมู่ / แนะนำ, โฟกัสไปปุ่ม X, หน้าข้างหลังไม่เลื่อน', async () => {
    open();
    await flush();
    expect(isOpen()).toBeTrue();
    expect(drawer().hasAttribute('inert')).toBeFalse();
    expect(Array.from(drawer().querySelectorAll('.drawer-nav a')).map(a => a.textContent!.replace(/home|category|auto_awesome/, '').trim()))
      .toEqual(['หน้าหลัก', 'หมวดหมู่', 'แนะนำ']);
    expect(document.activeElement).toBe(el.querySelector('.drawer-close'));
    expect(document.body.classList).toContain('drawer-open');
  });

  it('ปิดด้วยปุ่ม X -> แจ้ง open=false ให้ host และโฟกัสกลับปุ่มที่เปิด', async () => {
    open();
    (el.querySelector('.drawer-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flush();
    expect(isOpen()).toBeFalse();
    expect(fixture.componentInstance.open).toBeFalse();
    expect(document.activeElement).toBe(trigger());
    expect(document.body.classList).not.toContain('drawer-open');
  });

  it('คลิกนอกแผง (ฉากหลัง) -> ปิด', () => {
    open();
    (el.querySelector('.drawer-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(isOpen()).toBeFalse();
    expect(el.querySelector('.drawer-backdrop')).toBeNull();
  });

  it('กด Esc -> ปิด', () => {
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(isOpen()).toBeFalse();
  });

  it('เลือกเมนู -> ไปหน้านั้นและแผงปิดเอง', async () => {
    open();
    (Array.from(drawer().querySelectorAll('.drawer-nav a'))[1] as HTMLAnchorElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/category');
    expect(isOpen()).toBeFalse();
  });

  it('เปลี่ยนหน้าด้วยวิธีอื่น (เช่น ปุ่มย้อนกลับ) ระหว่างแผงเปิด -> ปิด', async () => {
    open();
    await router.navigateByUrl('/recommendations');
    fixture.detectChanges();
    expect(isOpen()).toBeFalse();
  });

  describe('เมนูบัญชีในแผง', () => {
    const accountItems = () => Array.from(drawer().querySelectorAll<HTMLElement>('.drawer-account a, .drawer-account button'));
    const label = (e: HTMLElement) => e.textContent!.replace(/person|manage_search|logout|login/, '').trim();

    function setLoggedIn(loggedIn: boolean): void {
      spyOn(auth, 'isLoggedIn').and.returnValue(loggedIn);
      fixture.detectChanges();
    }

    it('ยังไม่ล็อกอิน -> มีแค่ลิงก์ "เข้าสู่ระบบ" ไป /login', async () => {
      setLoggedIn(false);
      expect(accountItems().map(label)).toEqual(['เข้าสู่ระบบ']);
      const login = accountItems()[0] as HTMLAnchorElement;
      expect(login.getAttribute('href')).toBe('/login');
      open();
      login.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/login');
      expect(isOpen()).toBeFalse();
    });

    it('ล็อกอินแล้ว -> โปรไฟล์ / ประวัติ (ลิงก์) + ออกจากระบบ (ปุ่ม) ต่อท้ายเมนูหลัก', () => {
      setLoggedIn(true);
      const items = accountItems();
      expect(items.map(label)).toEqual(['โปรไฟล์ผู้ใช้', 'ประวัติการใช้งาน', 'ออกจากระบบ']);
      expect(items.map(e => e.getAttribute('href'))).toEqual(['/profile', '/history', null]);
      expect((items[2] as HTMLButtonElement).type).toBe('button');
      expect(items.every(e => e.getAttribute('aria-label'))).toBeTrue();
    });

    it('กดโปรไฟล์ -> ไป /profile และแผงปิด', async () => {
      setLoggedIn(true);
      open();
      accountItems()[0].click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe('/profile');
      expect(isOpen()).toBeFalse();
    });
  });

  describe('ยืนยันก่อนออกจากระบบ', () => {
    let logout: jasmine.Spy;
    const dialog = () => el.querySelector('app-logout-confirm [aria-modal="true"]') as HTMLElement | null;
    const button = (text: string) =>
      Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.trim() === text) as HTMLButtonElement;

    beforeEach(async () => {
      spyOn(auth, 'isLoggedIn').and.returnValue(true);
      logout = spyOn(auth, 'logout');
      open();
      (el.querySelector('.drawer-logout') as HTMLButtonElement).click();
      fixture.detectChanges();
      await flush();
    });

    it('กดออกจากระบบ -> ปิดแผงก่อน แล้วแสดง popup ยืนยัน (ยังไม่ออก) โฟกัสปุ่มยกเลิก', () => {
      expect(isOpen()).toBeFalse();
      expect(dialog()).not.toBeNull();
      expect(dialog()!.getAttribute('role')).toBe('dialog');
      expect(dialog()!.querySelector('h2')!.textContent!.trim()).toBe('ออกจากระบบ?');
      expect(dialog()!.textContent).toContain('คุณต้องการออกจากระบบใช่หรือไม่');
      expect(document.activeElement).toBe(button('ยกเลิก'));
      expect(logout).not.toHaveBeenCalled();
    });

    it('กดยกเลิก -> ปิด popup ไม่ออกจากระบบ โฟกัสกลับปุ่ม ☰', async () => {
      button('ยกเลิก').click();
      fixture.detectChanges();
      await flush();
      expect(dialog()).toBeNull();
      expect(logout).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(trigger());
    });

    it('กดพื้นหลังมืด -> ปิด popup ไม่ออกจากระบบ', () => {
      (el.querySelector('app-logout-confirm .overlay') as HTMLElement).click();
      fixture.detectChanges();
      expect(dialog()).toBeNull();
      expect(logout).not.toHaveBeenCalled();
    });

    it('กด Esc -> ปิด popup ไม่ออกจากระบบ', () => {
      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(dialog()).toBeNull();
      expect(logout).not.toHaveBeenCalled();
    });

    it('กดยืนยัน -> เรียก AuthService.logout() ตัวเดิมครั้งเดียว แล้วปิด popup', () => {
      button('ออกจากระบบ').click();
      fixture.detectChanges();
      expect(logout).toHaveBeenCalledTimes(1);
      expect(dialog()).toBeNull();
    });
  });
});
