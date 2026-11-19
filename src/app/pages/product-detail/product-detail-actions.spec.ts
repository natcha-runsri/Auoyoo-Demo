import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';

import { ProductDetailComponent } from './product-detail.component';
import { ProductService } from '../../services/product/product.service';
import { Product } from '../../models/product';
import { HistoryService } from '../../services/history/history.service';
import { CategoryService } from '../../services/category/category.service';
import { Category } from '../../models/category';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { CompareService } from '../../services/compare/compare.service';
import { FavoriteService } from '../../services/favorite/favorite.service';

// ลิงก์ร้านปลอม — ห้ามใช้ลิงก์ร้านค้าจริงในเทสต์
const headphone: Product = {
  id: 11, category: 'Headphone', productName: 'Wireless Headset BASEUS (BOWIE H1i) Stellar White', priceMin: 1490,
  url: 'https://shop.example.invalid/p/11', image: '', source: 'demo-b', priceAsOf: '2026-08-20', brand: 'BASEUS'
};
const other = (id: number): Product => ({ id, category: 'Mouse', productName: `เมาส์ ${id}`, url: 'https://shop.example.invalid/m' });
const MENU: Category[] = [{ name: 'อุปกรณ์ทั้งหมด', icon: 'grid_view', children: [
  { name: 'หูฟัง', icon: 'headphones', categoryKey: 'Headphone', slug: 'headphone' },
  { name: 'โน้ตบุ๊ก', icon: 'laptop_chromebook', categoryKey: 'Notebook', slug: 'notebook' }] }];

describe('ProductDetailComponent: แถบหัว + ปุ่มรายการโปรด/เปรียบเทียบ', () => {
  let fixture: ComponentFixture<ProductDetailComponent>;
  let el: HTMLElement;
  let loggedIn: boolean;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let http: HttpTestingController;
  let compare: CompareService;
  let menu$: Observable<Category[]>;

  const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const favButton = () => el.querySelector('.pd-fav') as HTMLButtonElement;
  const compareButton = () => el.querySelector('.pd-compare') as HTMLButtonElement;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '11' })) } },
        { provide: ProductService, useValue: { getById: () => of(headphone) } },
        { provide: HistoryService, useValue: jasmine.createSpyObj<HistoryService>('HistoryService', ['recordView']) },
        { provide: CategoryService, useValue: { getCategoryTree: () => menu$ } },
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
        { provide: AuthModalService, useValue: authModal }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    compare = TestBed.inject(CompareService);
    compare.clear();
    fixture = TestBed.createComponent(ProductDetailComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.removeItem('compareList');
    loggedIn = true;
    menu$ = of(MENU);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['open']);
  });

  afterEach(() => {
    compare?.clear();
    localStorage.removeItem('compareList');
  });

  it('แถบหัว: breadcrumb "หมวดหมู่ / รายละเอียด", หัวข้อชื่อหมวดภาษาไทย และไอคอนหมวดเดียวกับเมนู', async () => {
    await create();
    expect(text('.crumbs')).toBe('หมวดหมู่/รายละเอียด'); // ช่องไฟมาจาก CSS gap
    expect(text('.pd-hero-title')).toBe('หูฟัง');
    expect(text('.pd-hero-icon')).toBe('headphones');
    // ชื่อสินค้ายังเป็น h1 ของหน้า; ลิงก์กลับ/แถบ stub เดิมไม่มีแล้ว
    expect(text('h1')).toBe(headphone.productName);
    expect(el.querySelector('.pd-back')).toBeNull();
    expect(el.textContent).not.toContain('stub');
  });

  it('กด "หมวดหมู่" ใน breadcrumb -> ไปหน้าหมวดของสินค้านั้น (/category/headphone)', async () => {
    await create();
    expect(el.querySelector('.crumbs a')?.getAttribute('href')).toBe('/category/headphone');
  });

  it('โหลดเมนูไม่ได้ -> ใช้ชื่อ/ไอคอน/slug สำรองของหมวดเดียวกัน', async () => {
    menu$ = throwError(() => new Error('down'));
    await create();
    expect(text('.pd-hero-title')).toBe('หูฟัง');
    expect(text('.pd-hero-icon')).toBe('headphones');
    expect(el.querySelector('.crumbs a')?.getAttribute('href')).toBe('/category/headphone');
  });

  it('ตำแหน่ง: ราคา ณ วันที่ -> รายการโปรด | เปรียบเทียบ -> ปุ่มดูที่ร้าน', async () => {
    await create();
    const order = Array.from(el.querySelectorAll('.pd-price-date, .pd-actions, .pd-source-link')).map(e => e.classList[0]);
    expect(order).toEqual(['pd-price-date', 'pd-actions', 'pd-source-link']);
    expect(el.querySelector('.pd-actions .pd-divider')).not.toBeNull();
  });

  it('รายการโปรด: กดแล้วหัวใจทึบ "อยู่ในรายการโปรด" + ตัวเลข navbar เพิ่มทันที; กดอีกครั้งเอาออก', async () => {
    await create();
    const counts: number[] = [];
    TestBed.inject(FavoriteService).count$.subscribe(c => counts.push(c));
    expect(favButton().getAttribute('aria-pressed')).toBe('false');
    expect(favButton().getAttribute('aria-label')).toBe('เพิ่มในรายการโปรด');

    favButton().click();
    fixture.detectChanges();
    expect(favButton().getAttribute('aria-pressed')).toBe('true');
    expect(text('.pd-fav')).toContain('อยู่ในรายการโปรด');
    expect(favButton().querySelector('.material-symbols-outlined')?.classList).toContain('filled');
    expect(counts[counts.length - 1]).toBe(1);
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/favorites')).flush([headphone]);

    favButton().click();
    fixture.detectChanges();
    expect(favButton().getAttribute('aria-pressed')).toBe('false');
    expect(counts[counts.length - 1]).toBe(0);
    http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/favorites/11')).flush([]);
  });

  it('guest กดรายการโปรด -> เปิด popup ล็อกอิน ไม่บันทึก', async () => {
    loggedIn = false;
    await create();
    favButton().click();
    fixture.detectChanges();
    expect(authModal.open).toHaveBeenCalledOnceWith('login', jasmine.objectContaining({ reason: 'เข้าสู่ระบบเพื่อบันทึกรายการโปรด' }));
    expect(favButton().getAttribute('aria-pressed')).toBe('false');
    http.expectNone(r => r.url.endsWith('/favorites'));
  });

  it('เปรียบเทียบ: กดแล้ว "อยู่ในรายการเปรียบเทียบ" และเข้าแถบเปรียบเทียบ; กดอีกครั้งเอาออก', async () => {
    await create();
    expect(compareButton().getAttribute('aria-pressed')).toBe('false');
    expect(text('.pd-compare')).toContain('เปรียบเทียบอุปกรณ์');

    compareButton().click();
    fixture.detectChanges();
    expect(compare.isInCompare(11)).toBeTrue();
    expect(compareButton().getAttribute('aria-pressed')).toBe('true');
    expect(text('.pd-compare')).toContain('อยู่ในรายการเปรียบเทียบ');

    compareButton().click();
    fixture.detectChanges();
    expect(compare.isInCompare(11)).toBeFalse();
  });

  it('ครบ 4 ชิ้นแล้ว -> ปุ่มเปรียบเทียบกดไม่ได้ + tooltip; ชิ้นที่อยู่ในรายการแล้วยังกดเอาออกได้', async () => {
    await create();
    [1, 2, 3, 4].forEach(id => compare.toggle(other(id)));
    fixture.detectChanges();
    expect(compareButton().disabled).toBeTrue();
    expect(el.querySelector('.pd-action-wrap')?.getAttribute('title')).toBe('เปรียบเทียบได้สูงสุด 4 รายการ');
    expect(compareButton().getAttribute('aria-label')).toBe('เปรียบเทียบได้สูงสุด 4 รายการ');

    compare.remove(4);
    compare.toggle(headphone);
    fixture.detectChanges();
    expect(compareButton().disabled).toBeFalse();
    expect(compareButton().getAttribute('aria-pressed')).toBe('true');
  });
});
