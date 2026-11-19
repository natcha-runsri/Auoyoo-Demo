import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let el: HTMLElement;

  const hrefs = (selector: string) =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>(selector)).map(a => decodeURI(a.getAttribute('href') ?? ''));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ปุ่มหมวดหมู่ 5 อันใช้ slug ภาษาอังกฤษเดียวกับหน้าหมวดหมู่', () => {
    expect(hrefs('a.category-card')).toEqual([
      '/category/notebook', '/category/headphone', '/category/printer', '/category/accessories', '/category/keyboard'
    ]);
  });

  it('Gadget: 5 การ์ดเฉพาะหมวดที่มีสินค้า (ไม่มี Power Bank / Tablets) และ Keyboard / Mouse / Headphone ไปหมวดเดี่ยวของตัวเอง', () => {
    expect(hrefs('a.gadget-card')).toEqual([
      '/category/notebook', '/category/printer', '/category/keyboard', '/category/headphone', '/category/mouse'
    ]);
    const titles = Array.from(el.querySelectorAll('.gadget-label')).map(e => e.textContent?.trim());
    expect(titles).toEqual(['Laptops', 'Printer', 'Keyboard', 'Headphone', 'Mouse']);
    expect(el.textContent).not.toContain('Power Bank');
    expect(el.textContent).not.toContain('Tablets');
  });

  it('ตำแหน่งชื่อการ์ดตาม mockup: Laptops/Headphone ซ้ายล่าง, Printer/Keyboard/Mouse ขวาบน', () => {
    const pos = (area: string) => el.querySelector(`.gadget-${area} .gadget-label`)!.classList;
    expect(pos('laptop')).toContain('bottom-left');
    expect(pos('headphone')).toContain('bottom-left');
    for (const area of ['printer', 'keyboard', 'mouse']) {
      expect(pos(area)).withContext(area).toContain('top-right');
    }
  });

  it('รูปการ์ดทั้งหมดเป็นไฟล์ในเว็บเราเอง', () => {
    const srcs = Array.from(el.querySelectorAll<HTMLImageElement>('.gadget-card img')).map(i => i.getAttribute('src'));
    expect(srcs).toEqual(['images/lab.svg', 'images/prin.svg', 'images/gadget-keyboard.jpg', 'images/head.svg', 'images/gadget-mouse.jpg']);
  });

  describe('แถวหมวดหมู่เลื่อนแนวนอน', () => {
    const row = () => el.querySelector('.categories-row') as HTMLElement;
    const arrow = (dir: 'prev' | 'next') => el.querySelector(`.cat-arrow-${dir}`) as HTMLButtonElement;
    const hidden = (dir: 'prev' | 'next') => arrow(dir).classList.contains('hidden');

    /** บังคับให้แถวแคบ (เหมือนจอมือถือ) แล้วเช็กลูกศรใหม่ */
    function narrow(width: number): void {
      el.style.display = 'block';
      el.style.width = `${width}px`;
      component.updateCategoryArrows();
      fixture.detectChanges();
    }

    afterEach(() => el.removeAttribute('style'));

    it('ปุ่มลูกศรเป็น <button type="button"> มี aria-label', () => {
      expect(arrow('prev').type).toBe('button');
      expect(arrow('prev').getAttribute('aria-label')).toBe('เลื่อนหมวดหมู่ไปทางซ้าย');
      expect(arrow('next').getAttribute('aria-label')).toBe('เลื่อนหมวดหมู่ไปทางขวา');
    });

    it('ต้นแถว: ซ่อนลูกศรซ้าย แสดงลูกศรขวา; ท้ายแถว: กลับกัน', () => {
      narrow(375);
      expect(hidden('prev')).toBeTrue();
      expect(hidden('next')).toBeFalse();

      row().style.scrollBehavior = 'auto';
      row().scrollLeft = row().scrollWidth;
      component.updateCategoryArrows();
      fixture.detectChanges();
      expect(hidden('prev')).toBeFalse();
      expect(hidden('next')).toBeTrue();
    });

    it('การ์ดทั้งหมดพอดีจอ -> ซ่อนลูกศรทั้งสองข้าง', () => {
      // media query ในเทสต์อิงขนาดหน้าต่าง Karma — กำหนดจำนวนการ์ดต่อจอแบบจอ ≥1024px เอง
      row().style.setProperty('--cat-per-view', '6');
      narrow(1280);
      expect(row().scrollWidth).toBeLessThanOrEqual(row().clientWidth + 1);
      expect(hidden('prev')).toBeTrue();
      expect(hidden('next')).toBeTrue();
    });

    it('กดลูกศรขวา -> scrollBy ประมาณ 80% ของความกว้างที่เห็น', () => {
      narrow(375);
      const scrollBy = spyOn(row(), 'scrollBy');
      arrow('next').click();
      expect(scrollBy.calls.mostRecent().args as unknown[]).toEqual([{ left: row().clientWidth * 0.8, behavior: 'smooth' }]);
    });
  });
});
