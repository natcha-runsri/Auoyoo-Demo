import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FavoriteService } from './favorite.service';
import { AuthService } from '../authen/auth.service';
import { environment } from '../../../environments/environment';
import { Product } from '../../models/product';

// ลิงก์ร้านปลอม — ห้ามใช้ลิงก์ร้านค้าจริงในเทสต์
const product = (id: number): Product => ({ id, category: 'Mouse', productName: `สินค้า ${id}`, url: 'https://shop.example.invalid/p' });

describe('FavoriteService', () => {
  let service: FavoriteService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/favorites`;

  beforeEach(() => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn']);
    auth.isLoggedIn.and.returnValue(true);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }] });
    service = TestBed.inject(FavoriteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loading$ เป็นจริงระหว่างโหลดรายการ', () => {
    const states: boolean[] = [];
    service.loading$.subscribe(v => states.push(v));
    service.load(true);
    http.expectOne(base).flush([product(1)]);
    expect(states).toEqual([false, true, false]);
    expect(service.favorites.map(p => p.id)).toEqual([1]);
  });

  it('เพิ่มปกติไม่ส่ง savedAt; เลิกทำส่งเวลาบันทึกเดิมไปด้วย', () => {
    service.add(product(1)).subscribe();
    expect(http.expectOne(base).request.body).toEqual({ productId: 1 });
    service.add(product(2), '2026-10-12T12:00:00Z').subscribe();
    expect(http.expectOne(base).request.body).toEqual({ productId: 2, savedAt: '2026-10-12T12:00:00Z' });
  });

  it('ลบ -> รายการลดทันที (ตัวเลข navbar) ล้มเหลวก็คืนค่าเดิม', () => {
    service.load(true);
    http.expectOne(base).flush([product(1), product(2)]);
    service.remove(1).subscribe({ error: () => undefined });
    expect(service.favorites.map(p => p.id)).toEqual([2]);
    http.expectOne(`${base}/1`).flush(null, { status: 500, statusText: 'x' });
    expect(service.favorites.map(p => p.id)).toEqual([1, 2]);
  });
});
