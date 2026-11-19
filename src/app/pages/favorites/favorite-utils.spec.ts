import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FavoriteProduct } from '../../models/product';
import { parseSort, savedAgo, sortFavorites } from './favorite-utils';
import { FavoriteCardComponent } from './favorite-card.component';

// ลิงก์ร้านปลอม — ห้ามใช้ลิงก์ร้านค้าจริงในเทสต์
const item = (id: number, price: number | null, extra: Partial<FavoriteProduct> = {}): FavoriteProduct => ({
  id, category: 'Notebook', productName: `สินค้า ${id}`, url: 'https://shop.example.invalid/p',
  priceMin: price ?? undefined, priceMax: price ?? undefined, ...extra
});

describe('favorite-utils', () => {
  const list = [item(1, 500), item(2, null), item(3, 100), item(4, 300), item(5, 100)];

  it('ล่าสุด = ลำดับจาก backend (บันทึกล่าสุดก่อน)', () => {
    expect(sortFavorites(list, 'latest').map(p => p.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('ราคาต่ำ -> สูง / สูง -> ต่ำ: ไม่มีราคาอยู่ท้ายทั้งสองแบบ ราคาเท่ากันคงลำดับเดิม', () => {
    expect(sortFavorites(list, 'price-asc').map(p => p.id)).toEqual([3, 5, 4, 1, 2]);
    expect(sortFavorites(list, 'price-desc').map(p => p.id)).toEqual([1, 4, 3, 5, 2]);
  });

  it('ค่า sort ใน URL ที่ไม่รู้จัก = ล่าสุด', () => {
    expect(parseSort('price-asc')).toBe('price-asc');
    expect(parseSort('bogus')).toBe('latest');
    expect(parseSort(null)).toBe('latest');
  });

  it('เวลาที่บันทึก: สักครู่ / นาที / ชั่วโมง / วัน / เกิน 30 วันเป็นวันที่ไทย / ไม่มีเวลาซ่อน', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(savedAgo(ago(20_000), now)).toBe('บันทึกเมื่อสักครู่');
    expect(savedAgo(ago(5 * 60_000), now)).toBe('บันทึกเมื่อ 5 นาทีก่อน');
    expect(savedAgo(ago(2 * 3_600_000), now)).toBe('บันทึกเมื่อ 2 ชั่วโมงก่อน');
    expect(savedAgo(ago(3 * 86_400_000), now)).toBe('บันทึกเมื่อ 3 วันก่อน');
    expect(savedAgo(ago(30 * 86_400_000), now)).toBe('บันทึกเมื่อ 30 วันก่อน');
    expect(savedAgo('2026-08-20T03:00:00Z', now)).toBe('บันทึกเมื่อ 20 ส.ค. 2569');
    expect(savedAgo(null, now)).toBe('');
    expect(savedAgo('not-a-date', now)).toBe('');
  });
});

describe('FavoriteCardComponent', () => {
  function render(p: FavoriteProduct, now = new Date('2026-10-15T12:00:00Z')): HTMLElement {
    TestBed.configureTestingModule({ imports: [FavoriteCardComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(FavoriteCardComponent);
    fixture.componentRef.setInput('product', p);
    fixture.componentRef.setInput('now', now);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('ชื่อ ป้ายสเปก (ไม่เกิน 3 ข้ามป้ายว่าง) เวลาที่บันทึก ราคา และลิงก์ดูรายละเอียด — ไม่มีป้ายหมวด/ปุ่มนิ้วโป้ง', () => {
    const el = render(item(7, 31990, { highlights: ['1TB', '', 'M.2 SSD', 'AMD Ryzen AI 7', 'เกิน'], savedAt: '2026-10-12T12:00:00Z' }));
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('สินค้า 7');
    expect(Array.from(el.querySelectorAll('.spec')).map(s => s.textContent?.trim())).toEqual(['1TB', 'M.2 SSD', 'AMD Ryzen AI 7']);
    expect(el.querySelector('.saved')?.textContent?.trim()).toBe('บันทึกเมื่อ 3 วันก่อน');
    expect(el.querySelector('.price')?.textContent?.trim()).toBe('฿31,990');
    expect(el.querySelector('a.detail')?.getAttribute('href')).toBe('/products/7');
    expect(el.textContent).not.toContain('ราคาเฉพาะออนไลน์');
    expect(el.querySelector('.badge, .icon-btn')).toBeNull();
  });

  it('ไม่มีสเปก/เวลา -> ไม่แสดงป้ายและซ่อนบรรทัดเวลา; ปุ่มลบมี aria-label และ tooltip', () => {
    const el = render(item(8, null));
    expect(el.querySelector('.specs')).toBeNull();
    expect(el.querySelector('.saved')?.classList).toContain('empty');
    expect(el.querySelector('.price')?.textContent?.trim()).toBe('ไม่มีข้อมูลราคา');
    const remove = el.querySelector('.remove') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('ลบออกจากรายการโปรด: สินค้า 8');
    expect(remove.title).toBe('ลบออกจากรายการโปรด');
  });
});
