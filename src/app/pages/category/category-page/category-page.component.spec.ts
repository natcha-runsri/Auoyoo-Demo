import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of } from 'rxjs';

import { CategoryPageComponent, buildPageItems } from './category-page.component';
import { CategoryService } from '../../../services/category/category.service';
import { ProductService } from '../../../services/product/product.service';
import { Category } from '../../../models/category';
import { PageResponse, Product } from '../../../models/product';
import { HistoryService } from '../../../services/history/history.service';

const TREE: Category[] = [{
  name: 'อุปกรณ์ทั้งหมด', icon: 'grid_view', count: 8227, children: [
    { name: 'อุปกรณ์เสริม', icon: 'cable', categoryKey: 'Accessories', slug: 'accessories', count: 355 },
    { name: 'หูฟัง', icon: 'headphones', categoryKey: 'Headphone', slug: 'headphone', count: 1037 },
    { name: 'คีย์บอร์ด', icon: 'keyboard', categoryKey: 'Keyboard', slug: 'keyboard', count: 1638 },
    { name: 'จอมอนิเตอร์', icon: 'monitor', categoryKey: 'Monitor', slug: 'monitor', count: 568 },
    { name: 'เมาส์', icon: 'mouse', categoryKey: 'Mouse', slug: 'mouse', count: 1012 },
    { name: 'แผ่นรองเมาส์', icon: 'rectangle', categoryKey: 'Mouse Pad', slug: 'mouse-pad', count: 177 },
    { name: 'โน้ตบุ๊ก', icon: 'laptop_chromebook', categoryKey: 'Notebook', slug: 'notebook', count: 699 },
    { name: 'ปริ้นเตอร์', icon: 'print', categoryKey: 'Printer', slug: 'printer', count: 449 },
    { name: 'ลำโพง', icon: 'speaker', categoryKey: 'Speaker', slug: 'speaker', count: 480 }
  ]
}];

// ลิงก์ร้านปลอม — เทสต์ไม่โหลด/ไม่คลิก
const product = (id: number): Product => ({ id, category: 'Notebook', productName: `สินค้า ${id}`, url: 'https://shop.example.invalid/p', priceMin: 1000 });

function page(items: number, totalElements: number, number = 0): PageResponse<Product> {
  return { content: Array.from({ length: items }, (_, i) => product(number * 9 + i + 1)), totalElements,
    totalPages: Math.ceil(totalElements / 9), number, size: 9 };
}

describe('CategoryPageComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let history: jasmine.SpyObj<HistoryService>;
  let search: jasmine.Spy;
  let getBrands: jasmine.Spy;
  let getPriceRange: jasmine.Spy;

  const el = () => harness.routeNativeElement!;
  const lastSearch = () => search.calls.mostRecent().args[0];
  async function open(url: string): Promise<CategoryPageComponent> {
    const component = await harness.navigateByUrl(url, CategoryPageComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return component;
  }
  async function settle(): Promise<CategoryPageComponent> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeDebugElement!.componentInstance as CategoryPageComponent;
  }

  beforeEach(async () => {
    history = jasmine.createSpyObj<HistoryService>('HistoryService', ['recordSearch']);
    search = jasmine.createSpy('search').and.callFake(f => of(page(9, 120, f.page ?? 0)));
    getBrands = jasmine.createSpy('getBrands').and.returnValue(of([{ brand: 'HP', count: 64 }, { brand: 'ASUS', count: 132 }]));
    getPriceRange = jasmine.createSpy('getPriceRange').and.returnValue(of({ min: 11599, max: 235990 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'category', component: CategoryPageComponent },
          { path: 'category/:slug', component: CategoryPageComponent }
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CategoryService, useValue: { getCategoryTree: () => of(structuredClone(TREE)), getBrands } },
        { provide: ProductService, useValue: { search, getPriceRange } },
        { provide: HistoryService, useValue: history }
      ]
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  it('should create', async () => {
    expect(await open('/category')).toBeTruthy();
  });

  // ===================== หมวด / URL ตัวกรอง =====================

  it('ทุกหมวด: หน้าละ 9 ชิ้น หน้า 1 และไม่ส่งตัวกรองที่ไม่ได้ตั้ง', async () => {
    await open('/category');
    expect(lastSearch()).toEqual({ category: undefined, brand: undefined, minPrice: undefined, maxPrice: undefined,
      keyword: undefined, page: 0, size: 9 });
    expect(el().querySelectorAll('app-product-card').length).toBe(9);
    expect(getPriceRange).toHaveBeenCalledWith(null);
  });

  it('/category/speaker -> กรองหมวดลำโพงอย่างเดียว โหลดแบรนด์และช่วงราคาของหมวด', async () => {
    const page1 = await open('/category/speaker');
    expect(lastSearch().category).toBe('Speaker');
    expect(getBrands).toHaveBeenCalledWith('Speaker');
    expect(getPriceRange).toHaveBeenCalledWith('Speaker');
    expect(page1.priceFloor).toBe(11599);
    expect(page1.priceCeiling).toBe(235990);
  });

  it('ตัวกรองทั้งหมดอ่านจาก URL (รีเฟรช/แชร์ลิงก์แล้วได้ผลเดิม)', async () => {
    await open('/category/notebook?brand=HP&brand=asus&min=10000&max=40000&page=2&q=gaming');
    expect(lastSearch()).toEqual({ category: 'Notebook', brand: ['hp', 'asus'], minPrice: 10000, maxPrice: 40000,
      keyword: 'gaming', page: 1, size: 9 });
    const boxes = Array.from(el().querySelectorAll<HTMLInputElement>('.brand input'));
    expect(boxes.filter(b => b.checked).map(b => b.value)).toEqual(['hp', 'asus']);
  });

  it('ติ๊กแบรนด์ -> เพิ่มใน URL และกลับหน้า 1; เอาออก -> ลบจาก URL', async () => {
    const page1 = await open('/category/notebook?page=3');
    page1.onBrandToggle({ brand: 'hp', checked: true });
    await settle();
    expect(router.url).toBe('/category/notebook?brand=hp');
    expect(lastSearch().brand).toEqual(['hp']);
    page1.onBrandToggle({ brand: 'asus', checked: true });
    await settle();
    expect(router.url).toBe('/category/notebook?brand=hp&brand=asus');
    page1.onBrandToggle({ brand: 'hp', checked: false });
    await settle();
    expect(router.url).toBe('/category/notebook?brand=asus');
  });

  it('เปลี่ยนช่วงราคา -> min/max ใน URL กลับหน้า 1; ค่าเต็มช่วง (null) -> เอาออก', async () => {
    const page1 = await open('/category/notebook?page=2');
    page1.onPriceRangeChange({ min: 20000, max: null });
    await settle();
    expect(router.url).toBe('/category/notebook?min=20000');
    expect(lastSearch().minPrice).toBe(20000);
    expect(lastSearch().maxPrice).toBeUndefined();
    page1.onPriceRangeChange({ min: null, max: null });
    await settle();
    expect(router.url).toBe('/category/notebook');
  });

  it('min มากกว่า max ใน URL -> สลับให้ถูก', async () => {
    await open('/category?min=50000&max=10000');
    expect(lastSearch().minPrice).toBe(10000);
    expect(lastSearch().maxPrice).toBe(50000);
  });

  it('เลือกหมวดใหม่ -> ล้างแบรนด์/ราคา/หน้าของหมวดเดิม แต่คงคำค้น', async () => {
    const page1 = await open('/category/notebook?brand=hp&min=20000&page=2&q=pro');
    page1.onCategorySelect('headphone');
    await settle();
    expect(router.url).toBe('/category/headphone?q=pro');
  });

  it('ล้างตัวกรอง -> เหลือแค่หมวด; ปุ่มแสดงเฉพาะตอนมีการกรอง', async () => {
    let page1 = await open('/category/notebook');
    expect(el().querySelector('.clear-btn')).toBeNull();
    page1 = await open('/category/notebook?brand=hp&max=30000&q=x');
    (el().querySelector('.clear-btn') as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe('/category/notebook');
  });

  // ===================== แบ่งหน้า =====================

  it('เปลี่ยนหน้า -> page ใน URL (หน้า 1 ไม่ใส่); ก่อนหน้า/ถัดไปกดไม่ได้ที่หน้าแรก/สุดท้าย', async () => {
    await open('/category');
    const nav = () => Array.from(el().querySelectorAll<HTMLButtonElement>('.nav-btn'));
    expect(nav()[0].disabled).toBeTrue();
    (el().querySelector('.page-btn[aria-label="หน้า 2"]') as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe('/category?page=2');
    expect(lastSearch().page).toBe(1);
    expect(el().querySelector('.page-btn.active')?.textContent?.trim()).toBe('2');
    nav()[0].click();
    await settle();
    expect(router.url).toBe('/category');

    await open('/category?page=14');
    expect(nav()[1].disabled).toBeTrue();
  });

  it('เลขหน้าใน URL เกินจำนวนหน้า -> ไปหน้าสุดท้าย', async () => {
    await open('/category?page=99');
    await settle();
    expect(router.url).toBe('/category?page=14');
    expect(lastSearch().page).toBe(13);
  });

  it('เลขหน้าแบบจุดไข่ปลา (มือถือแสดงน้อยลง)', () => {
    expect(buildPageItems(1, 14)).toEqual([1, 2, 3, 4, 5, '...', 14]);
    expect(buildPageItems(7, 14)).toEqual([1, '...', 6, 7, 8, '...', 14]);
    expect(buildPageItems(14, 14)).toEqual([1, '...', 10, 11, 12, 13, 14]);
    expect(buildPageItems(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(buildPageItems(7, 14, 0)).toEqual([1, '...', 7, '...', 14]);
    expect(buildPageItems(1, 0)).toEqual([]);
  });

  // ===================== สถานะ =====================

  it('ระหว่างโหลด -> การ์ดโครงสีเทา 9 ใบ', async () => {
    const pending = new Subject<PageResponse<Product>>();
    search.and.returnValue(pending);
    await harness.navigateByUrl('/category');
    harness.detectChanges();
    expect(el().querySelectorAll('.skeleton').length).toBe(9);
    pending.next(page(3, 3));
    harness.detectChanges();
    expect(el().querySelectorAll('.skeleton').length).toBe(0);
    expect(el().querySelectorAll('app-product-card').length).toBe(3);
  });

  it('ไม่พบสินค้า -> ข้อความ + ปุ่มล้างตัวกรอง', async () => {
    search.and.returnValue(of(page(0, 0)));
    await open('/category/notebook?brand=nothing');
    expect(el().querySelector('.state')?.textContent).toContain('ไม่พบสินค้าที่ตรงกับตัวกรอง');
    (el().querySelector('.state-btn') as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe('/category/notebook');
  });

  // ===================== ค้นหา =====================

  it('/category?q=คำค้น -> ค้นคำนั้นทันที', async () => {
    const page1 = await open(`/category?q=${encodeURIComponent('เมาส์ไร้สาย')}`);
    expect(page1.searchKeyword).toBe('เมาส์ไร้สาย');
    expect(lastSearch().keyword).toBe('เมาส์ไร้สาย');
  });

  it('กดค้นหา -> บันทึกประวัติ และใส่คำค้นใน URL', async () => {
    const page1 = await open('/category');
    page1.searchKeyword = '  คีย์บอร์ดบลูทูธ ';
    page1.onSearch();
    await settle();
    expect(history.recordSearch).toHaveBeenCalledWith('คีย์บอร์ดบลูทูธ');
    expect(router.url).toBe(`/category?q=${encodeURIComponent('คีย์บอร์ดบลูทูธ')}`);
    expect(lastSearch().keyword).toBe('คีย์บอร์ดบลูทูธ');
  });

  it('ค้นหาจากหน้าหมวด (/category/notebook) -> กลับไปทุกหมวดพร้อมคำค้น', async () => {
    const page1 = await open('/category/notebook?brand=hp');
    page1.searchKeyword = 'asus';
    page1.onSearch();
    const next = await settle();
    expect(router.url).toBe('/category?q=asus');
    expect(next.searchKeyword).toBe('asus');
    expect(next.selectedNode).toBeNull();
  });

  // ===================== ลิงก์เก่า =====================

  const legacy: [string, string, string][] = [
    // ลิงก์หน้าหลักแบบเก่า / ชื่อหมวดเดิม
    ['โน้ตบุ๊ก', 'notebook', 'Notebook'],
    ['โน้ตบุ๊ค', 'notebook', 'Notebook'],
    ['เครื่องเสียง', 'headphone', 'Headphone'],
    ['เครื่องพิมพ์', 'printer', 'Printer'],
    ['อุปกรณ์เสริม', 'accessories', 'Accessories'],
    ['คีย์บอร์ด-เมาส์', 'keyboard', 'Keyboard'],
    ['ลำโพง', 'speaker', 'Speaker'],
    // slug กลุ่มรวมช่วง migration 011
    ['audio', 'headphone', 'Headphone'],
    ['keyboard-mouse', 'keyboard', 'Keyboard']
  ];
  for (const [oldSlug, newSlug, key] of legacy) {
    it(`/category/${oldSlug} -> /category/${newSlug}`, async () => {
      await harness.navigateByUrl(`/category/${encodeURIComponent(oldSlug)}`);
      const page1 = await settle();
      expect(router.url).toBe(`/category/${newSlug}`);
      expect(page1.selectedNode?.categoryKey).toBe(key);
    });
  }

  it('ชื่อหมวดในเมนู (/category/จอมอนิเตอร์) ก็พาไป slug ของหมวดนั้น และคงตัวกรองใน URL', async () => {
    await harness.navigateByUrl(`/category/${encodeURIComponent('จอมอนิเตอร์')}?brand=aoc`);
    await settle();
    expect(router.url).toBe('/category/monitor?brand=aoc');
  });

  it('เปลี่ยน URL แบบ replace -> กดย้อนกลับไม่เด้งกลับมา URL เก่า', async () => {
    const navigate = spyOn(router, 'navigate').and.callThrough();
    await harness.navigateByUrl(`/category/${encodeURIComponent('โน้ตบุ๊ก')}`);
    expect(navigate).toHaveBeenCalledWith(['/category', 'notebook'], jasmine.objectContaining({ replaceUrl: true }));
  });

  it('slug ที่ยังไม่มีหมวด (แบตสำรอง) -> คง URL เดิม แสดงทุกหมวด', async () => {
    const page1 = await open(`/category/${encodeURIComponent('แบตสำรอง')}`);
    expect(decodeURI(router.url)).toBe('/category/แบตสำรอง');
    expect(page1.selectedNode).toBeNull();
    expect(lastSearch().category).toBeUndefined();
  });

  // ===================== มือถือ =====================

  it('แผงตัวกรอง: เปิดจากปุ่ม "ตัวกรอง" และปิดด้วย Esc / ปุ่มปิด', async () => {
    const page1 = await open('/category/notebook?brand=hp');
    expect(el().querySelector('.filter-toggle')?.textContent).toContain('ตัวกรอง');
    expect(el().querySelector('.filter-count')?.textContent).toBe('1');
    page1.openFilters();
    harness.detectChanges();
    expect(el().querySelector('.sidebar')?.classList).toContain('open');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(el().querySelector('.sidebar')?.classList).not.toContain('open');
    expect(document.body.style.overflow).toBe('');
  });
});
