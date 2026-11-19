import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

@Component({ standalone: true, template: '<p>page</p>' })
class PageStubComponent {}

/** ปุ่ม ☰ ต่อกับ <app-drawer-menu> และโลโก้ใน header — พฤติกรรมของแผงเองอยู่ใน drawer-menu.component.spec.ts */
describe('AppComponent: ปุ่ม ☰ และโลโก้', () => {
  let fixture: ComponentFixture<AppComponent>;
  let el: HTMLElement;
  let router: Router;

  const menuButton = () => el.querySelector('.menu-btn') as HTMLButtonElement;
  const drawer = () => el.querySelector('#site-drawer') as HTMLElement;
  const isOpen = () => drawer().classList.contains('open');
  const flush = () => new Promise(r => setTimeout(r));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(),
        provideRouter([{ path: '', component: PageStubComponent }, { path: 'category', component: PageStubComponent }])]
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    el = fixture.nativeElement;
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
  });

  afterEach(() => document.body.classList.remove('drawer-open'));

  function open(): void {
    menuButton().click();
    fixture.detectChanges();
  }

  it('ปิดอยู่ตอนแรก: ซ่อนจาก screen reader และกดไม่ได้ (inert); ปุ่ม ☰ บอกสถานะ', () => {
    expect(isOpen()).toBeFalse();
    expect(drawer().getAttribute('aria-hidden')).toBe('true');
    expect(drawer().hasAttribute('inert')).toBeTrue();
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(menuButton().getAttribute('aria-controls')).toBe('site-drawer');
  });

  it('กด ☰ -> แผงเปิด, ปุ่ม ☰ บอกสถานะ, โฟกัสไปปุ่ม X, หน้าข้างหลังไม่เลื่อน', async () => {
    open();
    await flush();
    expect(isOpen()).toBeTrue();
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    expect(drawer().hasAttribute('inert')).toBeFalse();
    expect(document.activeElement).toBe(el.querySelector('.drawer-close'));
    expect(document.body.classList).toContain('drawer-open');
  });

  it('แผงปิด (ปุ่ม X) -> ปุ่ม ☰ กลับเป็นสถานะปิดและได้โฟกัสคืน', async () => {
    open();
    (el.querySelector('.drawer-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    await flush();
    expect(isOpen()).toBeFalse();
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menuButton());
    expect(document.body.classList).not.toContain('drawer-open');
  });

  it('โลโก้เป็นลิงก์กลับหน้าหลัก (routerLink, มี aria-label/alt)', async () => {
    const logo = el.querySelector('.header a.logo') as HTMLAnchorElement;
    expect(logo.getAttribute('href')).toBe('/');
    expect(logo.getAttribute('aria-label')).toBe('กลับหน้าหลัก Auoyoo');
    expect(logo.querySelector('img')!.getAttribute('alt')).toBeTruthy();
    await router.navigateByUrl('/category');
    logo.click();
    await fixture.whenStable();
    expect(router.url).toBe('/');
  });

  it('กดโลโก้ขณะอยู่หน้าหลัก -> เลื่อนขึ้นบนสุดแบบ smooth', () => {
    const scrollTo = spyOn(window, 'scrollTo');
    (el.querySelector('.header a.logo') as HTMLAnchorElement).click();
    expect(scrollTo.calls.mostRecent().args as unknown[]).toEqual([{ top: 0, behavior: 'smooth' }]);
  });

  it('header ติดบนจอ (sticky) มีเงาเฉพาะตอนเลื่อนลงจากบนสุด และแจ้งความสูงจริงเป็น --site-header-h', async () => {
    const header = el.querySelector('.header') as HTMLElement;
    document.body.appendChild(el); // ให้ header มีขนาดจริง
    await new Promise(r => setTimeout(r, 50)); // ResizeObserver
    expect(getComputedStyle(header).position).toBe('sticky');
    expect(getComputedStyle(header).top).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--site-header-h')).toBe(`${header.offsetHeight}px`);
    expect(header.classList).not.toContain('scrolled');

    const scrollY = spyOnProperty(window, 'scrollY').and.returnValue(240);
    window.dispatchEvent(new Event('scroll'));
    expect(header.classList).toContain('scrolled');
    scrollY.and.returnValue(0);
    window.dispatchEvent(new Event('scroll'));
    expect(header.classList).not.toContain('scrolled');
    el.remove();
  });
});
