import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CompareBarComponent, DOCK_GAP_PX } from './compare-bar.component';
import { ChatDockService } from '../../services/chat-dock/chat-dock.service';
import { CompareService } from '../../services/compare/compare.service';
import { Product } from '../../models/product';

// ลิงก์ร้านปลอม — ห้ามใช้ลิงก์ร้านค้าจริงในเทสต์
const product = (id: number, name = `Notebook ชื่อยาวมากสำหรับทดสอบการตัดสองบรรทัด ${id}`): Product => ({
  id, category: 'Notebook', productName: name, url: 'https://shop.example.invalid/p', priceMin: 31990
});

describe('CompareBarComponent', () => {
  let fixture: ComponentFixture<CompareBarComponent>;
  let compare: CompareService;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CompareBarComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    compare = TestBed.inject(CompareService);
    compare.clear();
    fixture = TestBed.createComponent(CompareBarComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => compare.clear());

  it('ไม่มีสินค้า -> ไม่แสดงแถบและไม่มีที่ว่างท้ายหน้า', () => {
    expect(el.querySelector('.compare-bar')).toBeNull();
    expect(el.querySelector('.cb-spacer')).toBeNull();
  });

  it('การ์ดในแถบ: รูป 64px ชื่อเต็ม (ตัด 2 บรรทัดด้วย CSS) ราคา และปุ่ม X อยู่ในการ์ดพร้อม aria-label', () => {
    compare.toggle(product(1));
    fixture.detectChanges();
    const card = el.querySelector('.cb-card')!;
    expect(card.querySelector('img')?.getAttribute('width')).toBe('64');
    expect(card.querySelector('.cb-name')?.textContent).toContain('ชื่อยาวมาก');
    expect(card.querySelector('.cb-price')?.textContent?.trim()).toBe('฿31,990');
    const remove = card.querySelector('.cb-remove') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe(`เอา ${product(1).productName} ออกจากการเปรียบเทียบ`);
    // X ต้องไม่ล้นออกนอกการ์ด (ไม่งั้นถูก overflow ของแถบตัดขอบ)
    const c = card.getBoundingClientRect();
    const x = remove.getBoundingClientRect();
    expect(x.top).toBeGreaterThanOrEqual(c.top);
    expect(x.right).toBeLessThanOrEqual(c.right);
    expect(x.width).toBeGreaterThanOrEqual(32);
    expect(x.height).toBeGreaterThanOrEqual(32);
  });

  it('กด X -> เอาชิ้นนั้นออก; ล้างทั้งหมด -> แถบหาย', () => {
    compare.toggle(product(1));
    compare.toggle(product(2));
    fixture.detectChanges();
    (el.querySelectorAll('.cb-remove')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compare.items.map(p => p.id)).toEqual([2]);
    (el.querySelector('.cb-clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.compare-bar')).toBeNull();
  });

  it('ปุ่มเปรียบเทียบกดได้เมื่อมีอย่างน้อย 2 ชิ้น แล้วไปหน้าเปรียบเทียบ', () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    compare.toggle(product(1));
    fixture.detectChanges();
    const go = el.querySelector('.cb-compare') as HTMLButtonElement;
    expect(go.disabled).toBeTrue();
    compare.toggle(product(2));
    fixture.detectChanges();
    expect(go.disabled).toBeFalse();
    go.click();
    expect(navigate).toHaveBeenCalledWith(['/recommendations'], { queryParams: { ids: '1,2' } });
  });

  it('มีที่ว่างท้ายหน้าเท่าความสูงแถบ เนื้อหาท้ายหน้าจึงเลื่อนพ้นแถบได้', async () => {
    compare.toggle(product(1));
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 50)); // รอ ResizeObserver
    fixture.detectChanges();
    const bar = el.querySelector('.compare-bar')!.getBoundingClientRect().height;
    const spacer = (el.querySelector('.cb-spacer') as HTMLElement).getBoundingClientRect().height;
    expect(bar).toBeGreaterThan(0);
    expect(Math.abs(spacer - bar)).toBeLessThanOrEqual(1);
  });

  it('ย่อแถบ -> ซ่อนการ์ดและปุ่ม เหลือหัวแถบ', () => {
    compare.toggle(product(1));
    fixture.detectChanges();
    (el.querySelector('.cb-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.cb-items')).toBeNull();
    expect(el.querySelector('.cb-toggle')?.getAttribute('aria-expanded')).toBe('false');
  });

  // ===================== หน้าแชท AI (ช่องพิมพ์ล็อกกับจอ) =====================

  describe('หน้าแชท AI (ChatDockService.active$)', () => {
    let dock: ChatDockService;
    const bar = () => el.querySelector('.compare-bar') as HTMLElement | null;

    beforeEach(() => {
      dock = TestBed.inject(ChatDockService);
      compare.toggle(product(1));
      compare.toggle(product(2));
      fixture.detectChanges();
    });

    afterEach(() => {
      dock.active$.next(false);
      dock.dockTop$.next(0);
    });

    it('หุบเป็นแบบย่อ: "เปรียบเทียบ 2/4" + ปุ่มเปรียบเทียบ ไม่มีการ์ด/ล้างทั้งหมด และวางเหนือช่องพิมพ์ ไม่มีที่ว่างท้ายหน้าซ้ำ', () => {
      dock.dockTop$.next(120);
      dock.active$.next(true);
      fixture.detectChanges();

      expect(bar()!.classList).toContain('docked');
      expect(bar()!.classList).toContain('collapsed');
      expect(el.querySelector('.cb-count')?.textContent?.trim()).toBe('2/4');
      expect(el.querySelector('.cb-title')?.textContent?.trim()).toBe('เปรียบเทียบ');
      expect(el.querySelector('.cb-compare')).not.toBeNull();
      expect(el.querySelector('.cb-clear')).toBeNull();
      expect(el.querySelector('.cb-items')).toBeNull();
      expect(bar()!.style.bottom).toBe(`${120 + DOCK_GAP_PX}px`);
      expect(el.querySelector('.cb-spacer')).toBeNull();
    });

    it('แบบย่อกดเปรียบเทียบได้เลย; กดหัวแถบแล้วกางเต็ม (การ์ด + ล้างทั้งหมด)', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      dock.active$.next(true);
      fixture.detectChanges();

      (el.querySelector('.cb-compare') as HTMLButtonElement).click();
      expect(router.navigate).toHaveBeenCalledWith(['/recommendations'], { queryParams: { ids: '1,2' } });

      (el.querySelector('.cb-toggle') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelectorAll('.cb-card').length).toBe(2);
      expect(el.querySelector('.cb-clear')).not.toBeNull();
    });

    it('เพิ่มสินค้าระหว่างอยู่หน้าแชท -> ไม่กางเอง (ไม่บังแชท) แต่จำนวนเปลี่ยน', () => {
      dock.active$.next(true);
      fixture.detectChanges();
      compare.toggle(product(3));
      fixture.detectChanges();
      expect(bar()!.classList).toContain('collapsed');
      expect(el.querySelector('.cb-count')?.textContent?.trim()).toBe('3/4');
    });

    it('ออกจากหน้าแชท -> กลับเป็นแบบเดิมทุกอย่าง (กาง, ล่างจอ, มีที่ว่างท้ายหน้า)', () => {
      dock.active$.next(true);
      fixture.detectChanges();
      dock.active$.next(false);
      fixture.detectChanges();

      expect(bar()!.classList).not.toContain('docked');
      expect(bar()!.classList).not.toContain('collapsed');
      expect(bar()!.style.bottom).toBe('');
      expect(el.querySelector('.cb-spacer')).not.toBeNull();
      expect(el.querySelectorAll('.cb-card').length).toBe(2);
    });
  });
});
