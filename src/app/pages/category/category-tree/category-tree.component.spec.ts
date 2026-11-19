import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BRAND_PREVIEW, CategoryTreeComponent } from './category-tree.component';
import { Category } from '../../../models/category';
import { BrandCount } from '../../../services/category/category.service';

function tree(): Category[] {
  return [
    { name: 'อุปกรณ์ทั้งหมด', icon: 'grid_view', count: 100, children: [
      { name: 'โน้ตบุ๊ก', icon: 'laptop_chromebook', categoryKey: 'Notebook', slug: 'notebook', count: 40 },
      { name: 'อุปกรณ์เครื่องเสียง', icon: 'headphones', categoryKey: 'Headphone,Speaker', slug: 'audio', count: 60 }
    ] },
    { name: 'คอมพิวเตอร์เซ็ต', icon: 'desktop_windows', count: 3, children: [
      { name: 'คอมพิวเตอร์เซ็ต', icon: 'desktop_windows', categoryKey: 'Computer Set,Computer / PC', slug: 'computer-set', count: 3 }
    ] }
  ];
}

const BRANDS: BrandCount[] = [
  ...['ASUS', 'LENOVO', 'HP', 'ACER', 'DELL', 'MSI', 'MICROSOFT', 'GIGABYTE', 'SURFACE'].map((brand, i) => ({ brand, count: 100 - i })),
  { brand: 'Unknown', count: 275 }
];

describe('CategoryTreeComponent', () => {
  let fixture: ComponentFixture<CategoryTreeComponent>;
  let component: CategoryTreeComponent;
  let el: HTMLElement;
  let selected: (string | null)[];

  const capsules = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.capsule'));
  const leaves = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.leaf'));
  const brandLabels = () => Array.from(el.querySelectorAll('.brand-name')).map(b => b.textContent?.trim());

  function render(selectedSlug: string | null, brands: BrandCount[] = [], selectedBrands: string[] = []): void {
    fixture.componentRef.setInput('categories', tree());
    fixture.componentRef.setInput('selectedSlug', selectedSlug);
    fixture.componentRef.setInput('brands', brands);
    fixture.componentRef.setInput('selectedBrands', selectedBrands);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CategoryTreeComponent] }).compileComponents();
    fixture = TestBed.createComponent(CategoryTreeComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    selected = [];
    component.categorySelect.subscribe(s => selected.push(s));
  });

  it('ยังไม่เลือกหมวด: กางกลุ่มแรก แสดงหมวดย่อยพร้อมไอคอน และกลุ่มหมวดเดียวเป็นแคปซูล', () => {
    render(null);
    expect(capsules().map(c => c.querySelector('.label')?.textContent)).toEqual(['อุปกรณ์ทั้งหมด', 'คอมพิวเตอร์เซ็ต']);
    expect(capsules().map(c => c.querySelector('.icon')?.textContent)).toEqual(['grid_view', 'desktop_windows']);
    expect(capsules().map(c => c.querySelector('.chevron')?.textContent)).toEqual(['expand_more', 'chevron_right']);
    expect(capsules()[0].getAttribute('aria-expanded')).toBe('true');
    expect(capsules()[0].classList).toContain('all-selected');
    expect(leaves().map(l => l.querySelector('.label')?.textContent)).toEqual(['โน้ตบุ๊ก', 'อุปกรณ์เครื่องเสียง']);
    expect(leaves()[1].querySelector('.icon')?.textContent).toBe('headphones');
  });

  it('กดหมวดย่อย -> แจ้ง slug; กดกลุ่มหมวดเดียว -> แจ้ง slug ของหมวดนั้น', () => {
    render(null);
    leaves()[0].click();
    capsules()[1].click();
    expect(selected).toEqual(['notebook', 'computer-set']);
  });

  it('กาง/หุบกลุ่มด้วยปุ่ม (คีย์บอร์ดกด Enter/Space ได้เพราะเป็น <button>)', () => {
    render(null);
    capsules()[0].click(); // เลือก "ทั้งหมด" อยู่แล้ว -> หุบ
    fixture.detectChanges();
    expect(capsules()[0].getAttribute('aria-expanded')).toBe('false');
    expect(leaves().length).toBe(0);
    capsules()[0].click();
    fixture.detectChanges();
    expect(leaves().length).toBe(2);
    expect(selected).toEqual([]);
  });

  it('เลือกหมวดอยู่ -> กดอุปกรณ์ทั้งหมด = กลับไปดูทุกหมวด', () => {
    render('notebook');
    capsules()[0].click();
    expect(selected).toEqual([null]);
  });

  it('หมวดที่เลือก: แคปซูลเหลือง + checkbox แบรนด์ (8 อันแรก, "ไม่ระบุแบรนด์" ท้ายสุดเมื่อกดดูเพิ่มเติม)', () => {
    render('notebook', BRANDS);
    const active = el.querySelector('.leaf.selected')!;
    expect(active.textContent).toContain('โน้ตบุ๊ก');
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(brandLabels().length).toBe(BRAND_PREVIEW);
    const more = el.querySelector('.more') as HTMLButtonElement;
    expect(more.textContent?.trim()).toBe('ดูเพิ่มเติม (2)');
    more.click();
    fixture.detectChanges();
    expect(brandLabels().length).toBe(BRANDS.length);
    expect(brandLabels()[brandLabels().length - 1]).toBe('ไม่ระบุแบรนด์');
  });

  it('ติ๊กแบรนด์ -> แจ้งชื่อตัวพิมพ์เล็ก; แบรนด์ใน URL ถูกติ๊กไว้ และแบรนด์ที่ติ๊กเกิน 8 อันแรกทำให้แสดงทั้งหมด', () => {
    render('notebook', BRANDS, ['hp', 'unknown']);
    const boxes = Array.from(el.querySelectorAll<HTMLInputElement>('.brand input'));
    expect(boxes.length).toBe(BRANDS.length);
    expect(boxes.filter(b => b.checked).map(b => b.value)).toEqual(['hp', 'unknown']);
    const events: unknown[] = [];
    component.brandToggle.subscribe(e => events.push(e));
    boxes[0].click();
    expect(events).toEqual([{ brand: 'asus', checked: true }]);
  });

  it('API ไม่ส่ง icon (backend เก่า) -> ใช้ไอคอนตามหมวดใน DB แต่ละหมวดไม่ซ้ำกัน', () => {
    fixture.componentRef.setInput('categories', [{ name: 'อุปกรณ์ทั้งหมด', count: 3, children: [
      { name: 'หูฟัง', categoryKey: 'Headphone', slug: 'headphone', count: 1 },
      { name: 'ลำโพง', categoryKey: 'Speaker', slug: 'speaker', count: 1 },
      { name: 'แผ่นรองเมาส์', categoryKey: 'Mouse Pad', slug: 'mouse-pad', count: 1 }
    ] }]);
    fixture.componentRef.setInput('selectedSlug', null);
    fixture.detectChanges();
    expect(capsules()[0].querySelector('.icon')?.textContent).toBe('grid_view');
    expect(leaves().map(l => l.querySelector('.icon')?.textContent)).toEqual(['headphones', 'speaker', 'rectangle']);
  });

  it('หมวดในกลุ่มหมวดเดียว (คอมพิวเตอร์เซ็ต) ที่ถูกเลือก -> แคปซูลเหลืองและแบรนด์อยู่ใต้แคปซูล', () => {
    render('computer-set', [{ brand: 'HP', count: 2 }]);
    expect(capsules()[1].classList).toContain('selected');
    expect(brandLabels()).toEqual(['HP']);
  });
});
