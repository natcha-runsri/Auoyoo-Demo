import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { FavoritesComponent, LEAVE_MS, UNDO_MS } from './favorites.component';
import { FavoriteService } from '../../services/favorite/favorite.service';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { FavoriteProduct, Product } from '../../models/product';

// ลิงก์ร้านปลอม — ห้ามใช้ลิงก์ร้านค้าจริงในเทสต์
const product = (id: number, category: string, price: number | null = 1000, savedAt: string | null = null): FavoriteProduct => ({
  id, category, productName: `สินค้า ${id}`, priceMin: price ?? undefined, priceMax: price ?? undefined,
  url: `https://shop.example.invalid/p/${id}`, image: '', source: 'demo-a', savedAt, highlights: []
});

describe('FavoritesComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let favorites$: BehaviorSubject<Product[]>;
  let loading$: BehaviorSubject<boolean>;
  let favoriteService: jasmine.SpyObj<FavoriteService>;
  let auth: jasmine.SpyObj<AuthService>;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let component: FavoritesComponent;
  let el: HTMLElement;

  const names = () => Array.from(el.querySelectorAll('app-favorite-card .name')).map(n => n.textContent?.trim());
  const text = (s: string) => el.querySelector(s)?.textContent?.trim() ?? '';

  async function open(url = '/favorites', loggedIn = true): Promise<void> {
    auth.isLoggedIn.and.returnValue(loggedIn);
    component = await harness.navigateByUrl(url, FavoritesComponent);
    el = harness.routeNativeElement!;
    harness.detectChanges();
  }

  beforeEach(async () => {
    favorites$ = new BehaviorSubject<Product[]>([]);
    loading$ = new BehaviorSubject(false);
    favoriteService = jasmine.createSpyObj<FavoriteService>('FavoriteService',
      ['load', 'isFavorite', 'isFavorite$', 'requiresLogin', 'toggle', 'add', 'remove'],
      { favorites$: favorites$.asObservable(), loading$: loading$.asObservable() });
    Object.defineProperty(favoriteService, 'favorites', { get: () => favorites$.value });
    favoriteService.remove.and.callFake(id => {
      favorites$.next(favorites$.value.filter(p => p.id !== id));
      return of(favorites$.value);
    });
    favoriteService.add.and.callFake((p: Product) => {
      favorites$.next([p, ...favorites$.value]);
      return of(favorites$.value);
    });
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn']);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['open']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'favorites', component: FavoritesComponent }, { path: 'category', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FavoriteService, useValue: favoriteService },
        { provide: AuthService, useValue: auth },
        { provide: AuthModalService, useValue: authModal }
      ]
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  it('should create', async () => {
    await open();
    expect(component).toBeTruthy();
    expect(favoriteService.load).toHaveBeenCalledWith(true);
  });

  it('ยังไม่ล็อกอิน -> ชวนเข้าสู่ระบบพร้อมเหตุผล (พฤติกรรมเดิม)', async () => {
    await open('/favorites', false);
    expect(el.querySelector('.state')?.textContent).toContain('เข้าสู่ระบบ');
    component.promptLogin();
    expect(authModal.open).toHaveBeenCalledWith('login', { reason: 'เข้าสู่ระบบเพื่อดูรายการโปรดของคุณ' });
  });

  // ===== แท็บหมวด (ตรรกะเดิม) =====

  it('แท็บหมวด = ทั้งหมด + หมวดที่มีในรายการโปรด และเลือกแท็บแล้วกรองตามหมวด', async () => {
    favorites$.next([product(1, 'Notebook'), product(2, 'Mouse'), product(3, 'Notebook')]);
    await open();
    let tabs: string[] = [];
    let visible: Product[] = [];
    component.tabs$.subscribe(t => (tabs = t));
    component.visible$.subscribe(v => (visible = v));
    expect(tabs).toEqual(['ทั้งหมด', 'Mouse', 'Notebook']);
    expect(visible.length).toBe(3);
    component.selectTab('Notebook');
    expect(visible.map(p => p.id)).toEqual([1, 3]);
    harness.detectChanges();
    expect(el.querySelectorAll('app-favorite-card').length).toBe(2);
  });

  it('ชื่อแท็บแสดงเป็นภาษาไทย แท็บที่เลือกถูกไฮไลต์', async () => {
    favorites$.next([product(1, 'Notebook'), product(2, 'Mouse')]);
    await open();
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('.fav-tab'));
    expect(tabs.map(t => t.textContent?.trim())).toEqual(['ทั้งหมด', 'เมาส์', 'โน้ตบุ๊ก']);
    expect(tabs[0].getAttribute('aria-pressed')).toBe('true');
  });

  // ===== หัวข้อ =====

  it('หัวข้อ "คุณบันทึกไว้ N รายการ" นับจริง', async () => {
    favorites$.next([product(1, 'Notebook'), product(2, 'Mouse'), product(3, 'Mouse')]);
    await open();
    expect(text('.fav-title')).toBe('คุณบันทึกไว้ 3 รายการ');
    expect(el.querySelector('.crumbs a')?.getAttribute('href')).toBe('/');
  });

  // ===== เรียงลำดับ =====

  it('เรียงตาม: ล่าสุด / ราคาต่ำ -> สูง / สูง -> ต่ำ จาก URL (?sort=) สินค้าไม่มีราคาอยู่ท้าย', async () => {
    favorites$.next([product(1, 'Mouse', 500), product(2, 'Mouse', null), product(3, 'Mouse', 100)]);
    await open('/favorites');
    expect(names()).toEqual(['สินค้า 1', 'สินค้า 2', 'สินค้า 3']);
    await open('/favorites?sort=price-asc');
    expect(names()).toEqual(['สินค้า 3', 'สินค้า 1', 'สินค้า 2']);
    expect(text('.sort-btn')).toContain('ราคา: ต่ำ');
    await open('/favorites?sort=price-desc');
    expect(names()).toEqual(['สินค้า 1', 'สินค้า 3', 'สินค้า 2']);
  });

  it('เมนูเรียงลำดับ: เปิดด้วยคีย์บอร์ด เลื่อน ↑↓ เลือกแล้วเก็บใน URL; Esc ปิด', async () => {
    favorites$.next([product(1, 'Mouse', 500), product(2, 'Mouse', 100)]);
    await open();
    const button = el.querySelector('.sort-btn') as HTMLButtonElement;
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>('.sort-item'));
    expect(items.map(i => i.getAttribute('aria-label'))).toEqual(['ล่าสุด', 'ราคา: ต่ำ → สูง', 'ราคา: สูง → ต่ำ']);
    expect(items[0].classList).toContain('active');
    expect(document.activeElement).toBe(items[0]);
    items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(document.activeElement).toBe(items[1]);
    items[1].click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/favorites?sort=price-asc');
    expect(el.querySelector('.sort-menu')).toBeNull();
    expect(names()).toEqual(['สินค้า 2', 'สินค้า 1']);

    button.click();
    harness.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(el.querySelector('.sort-menu')).toBeNull();
  });

  // ===== ลบ + เลิกทำ =====

  it('ลบ -> ตัวเลขลดทันที การ์ดค่อย ๆ หายไป มีแถบเลิกทำ 5 วิ; เลิกทำ -> กลับมาพร้อมเวลาบันทึกเดิม', fakeAsync(() => {
    const saved = '2026-10-12T12:00:00.000Z';
    favorites$.next([product(1, 'Mouse', 100, saved), product(2, 'Mouse', 200)]);
    harness.navigateByUrl('/favorites', FavoritesComponent).then(c => (component = c));
    auth.isLoggedIn.and.returnValue(true);
    tick();
    el = harness.routeNativeElement!;
    harness.detectChanges();

    (el.querySelector('app-favorite-card .remove') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(favoriteService.remove).toHaveBeenCalledWith(1);
    expect(text('.fav-title')).toBe('คุณบันทึกไว้ 1 รายการ');
    // ยังเห็นการ์ดแบบกำลังหายไปที่ตำแหน่งเดิม
    expect(names()).toEqual(['สินค้า 1', 'สินค้า 2']);
    expect(el.querySelector('app-favorite-card .card')?.classList).toContain('leaving');
    expect(text('.snackbar')).toContain('ลบออกจากรายการโปรดแล้ว');

    tick(LEAVE_MS);
    harness.detectChanges();
    expect(names()).toEqual(['สินค้า 2']);

    (el.querySelector('.undo-btn') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(favoriteService.add).toHaveBeenCalledWith(jasmine.objectContaining({ id: 1 }), saved);
    expect(el.querySelector('.snackbar')).toBeNull();
    expect(text('.fav-title')).toBe('คุณบันทึกไว้ 2 รายการ');
  }));

  it('แถบเลิกทำหายเองหลัง 5 วินาที', fakeAsync(() => {
    favorites$.next([product(1, 'Mouse')]);
    auth.isLoggedIn.and.returnValue(true);
    harness.navigateByUrl('/favorites', FavoritesComponent);
    tick();
    el = harness.routeNativeElement!;
    harness.detectChanges();
    (el.querySelector('app-favorite-card .remove') as HTMLButtonElement).click();
    tick(UNDO_MS - 1);
    harness.detectChanges();
    expect(el.querySelector('.snackbar')).not.toBeNull();
    tick(1);
    harness.detectChanges();
    expect(el.querySelector('.snackbar')).toBeNull();
  }));

  it('ลบชิ้นสุดท้ายของแท็บที่เลือก -> กลับไปแท็บทั้งหมด', fakeAsync(() => {
    favorites$.next([product(1, 'Notebook'), product(2, 'Mouse')]);
    auth.isLoggedIn.and.returnValue(true);
    harness.navigateByUrl('/favorites', FavoritesComponent).then(c => (component = c));
    tick();
    el = harness.routeNativeElement!;
    component.selectTab('Notebook');
    harness.detectChanges();
    (el.querySelector('app-favorite-card .remove') as HTMLButtonElement).click();
    tick(LEAVE_MS);
    harness.detectChanges();
    expect(names()).toEqual(['สินค้า 2']);
    tick(UNDO_MS);
  }));

  it('ลบไม่สำเร็จ -> service คืนรายการเดิม การ์ดกลับมา', fakeAsync(() => {
    favorites$.next([product(1, 'Mouse')]);
    favoriteService.remove.and.returnValue(throwError(() => new Error('x')));
    auth.isLoggedIn.and.returnValue(true);
    harness.navigateByUrl('/favorites', FavoritesComponent);
    tick();
    el = harness.routeNativeElement!;
    harness.detectChanges();
    (el.querySelector('app-favorite-card .remove') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(el.querySelector('app-favorite-card .card')?.classList).not.toContain('leaving');
    tick(UNDO_MS);
  }));

  // ===== สถานะ =====

  it('ระหว่างโหลด -> การ์ดโครงสีเทา', async () => {
    loading$.next(true);
    await open();
    expect(el.querySelectorAll('.skeleton').length).toBe(6);
  });

  it('ไม่มีรายการ -> ไอคอน + ข้อความ + ปุ่มไปดูสินค้า', async () => {
    await open();
    expect(text('.state p')).toBe('ยังไม่มีสินค้าในรายการโปรด');
    expect(el.querySelector('.state a')?.getAttribute('href')).toBe('/category');
    expect(text('.fav-title')).toBe('คุณบันทึกไว้ 0 รายการ');
  });
});
