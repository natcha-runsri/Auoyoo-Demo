import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { ProductCardComponent } from './product-card.component';
import { Product } from '../../../models/product';
import { FavoriteService } from '../../../services/favorite/favorite.service';
import { CompareService } from '../../../services/compare/compare.service';
import { AuthModalService } from '../../../services/auth-modal/auth-modal.service';

// ลิงก์ร้านปลอม — ห้ามใช้ลิงก์ร้านค้าจริงในเทสต์
const product: Product = {
  id: 7, category: 'Notebook', brand: 'HP', productName: 'Notebook HP OmniBook 5 16-ag1024AU (Sky Blue)',
  url: 'https://shop.example.invalid/p/7', priceMin: 31990, priceAsOf: '2026-08-20'
};

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  let el: HTMLElement;
  let favorite$: BehaviorSubject<boolean>;
  let inCompare$: BehaviorSubject<boolean>;
  let full$: BehaviorSubject<boolean>;
  let favorites: jasmine.SpyObj<FavoriteService>;
  let compare: jasmine.SpyObj<CompareService>;
  let authModal: jasmine.SpyObj<AuthModalService>;

  const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.icon-btn'));

  function create(p: Product = product): void {
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', p);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(async () => {
    favorite$ = new BehaviorSubject(false);
    inCompare$ = new BehaviorSubject(false);
    full$ = new BehaviorSubject(false);
    favorites = jasmine.createSpyObj<FavoriteService>('FavoriteService', ['isFavorite$', 'requiresLogin', 'toggle']);
    favorites.isFavorite$.and.returnValue(favorite$);
    favorites.requiresLogin.and.returnValue(false);
    favorites.toggle.and.returnValue(of([]));
    compare = jasmine.createSpyObj<CompareService>('CompareService', ['isInCompare$', 'isFull$', 'toggle'], { max: 4 });
    compare.isInCompare$.and.returnValue(inCompare$);
    compare.isFull$.and.returnValue(full$);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['open']);
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [
        provideRouter([]),
        { provide: FavoriteService, useValue: favorites },
        { provide: CompareService, useValue: compare },
        { provide: AuthModalService, useValue: authModal }
      ]
    }).compileComponents();
  });

  it('แสดงตามดีไซน์: ป้ายหมวดภาษาไทย ชื่อ "ราคาเฉพาะออนไลน์" ราคา และปุ่มดูรายละเอียดไปหน้าสินค้า', () => {
    create();
    expect(el.querySelector('.badge')?.textContent?.trim()).toBe('โน้ตบุ๊ก');
    expect(el.querySelector('.name')?.textContent?.trim()).toBe(product.productName);
    expect(el.querySelector('.price-label')?.textContent?.trim()).toBe('ราคาเฉพาะออนไลน์');
    expect(el.querySelector('.price')?.textContent?.trim()).toBe('฿31,990');
    const detail = el.querySelector('a.detail-btn') as HTMLAnchorElement;
    expect(detail.getAttribute('href')).toBe('/products/7');
    expect(detail.textContent).toContain('ดูรายละเอียด');
  });

  it('ไม่แสดงวันที่ราคาบนการ์ด (ย้ายไปหน้ารายละเอียดสินค้า)', () => {
    create();
    expect(el.textContent).not.toContain('ราคา ณ');
  });

  it('สินค้าไม่มีราคา -> "ไม่มีข้อมูลราคา" แทน ฿0', () => {
    create({ ...product, priceMin: undefined, priceMax: undefined });
    expect(el.querySelector('.price')?.textContent?.trim()).toBe('ไม่มีข้อมูลราคา');
  });

  it('ปุ่มทั้งสองมี aria-label และ tooltip บอกว่าทำอะไร และเปลี่ยนตามสถานะ', () => {
    create();
    const [fav, cmp] = buttons();
    expect(fav.getAttribute('aria-label')).toBe(`เพิ่มในรายการโปรด: ${product.productName}`);
    expect(fav.title).toBe('เพิ่มในรายการโปรด');
    expect(cmp.getAttribute('aria-label')).toBe(`เพิ่มในรายการเปรียบเทียบ: ${product.productName}`);
    expect(cmp.title).toBe('เพิ่มในรายการเปรียบเทียบ');

    favorite$.next(true);
    inCompare$.next(true);
    fixture.detectChanges();
    expect(fav.classList).toContain('active');
    expect(fav.getAttribute('aria-pressed')).toBe('true');
    expect(fav.title).toBe('ลบออกจากรายการโปรด');
    expect(cmp.classList).toContain('active');
    expect(cmp.getAttribute('aria-label')).toBe(`ลบออกจากรายการเปรียบเทียบ: ${product.productName}`);
  });

  it('กดรายการโปรดตอนล็อกอิน -> toggle ในระบบเดิม; ยังไม่ล็อกอิน -> popup ล็อกอิน', () => {
    create();
    buttons()[0].click();
    expect(favorites.toggle).toHaveBeenCalledWith(product);

    favorites.toggle.calls.reset();
    favorites.requiresLogin.and.returnValue(true);
    buttons()[0].click();
    expect(favorites.toggle).not.toHaveBeenCalled();
    expect(authModal.open).toHaveBeenCalledWith('login', { reason: 'เข้าสู่ระบบเพื่อบันทึกรายการโปรด' });
  });

  it('กดเปรียบเทียบ -> toggle ในแถบเปรียบเทียบ; แถบเต็มและยังไม่อยู่ในแถบ -> ปุ่มกดไม่ได้พร้อมบอกเหตุผล', () => {
    create();
    buttons()[1].click();
    expect(compare.toggle).toHaveBeenCalledWith(product);

    full$.next(true);
    fixture.detectChanges();
    expect(buttons()[1].disabled).toBeTrue();
    expect(buttons()[1].title).toBe('เปรียบเทียบได้สูงสุด 4 ชิ้น');

    inCompare$.next(true);
    fixture.detectChanges();
    expect(buttons()[1].disabled).toBeFalse(); // อยู่ในแถบแล้ว เอาออกได้เสมอ
  });
});
