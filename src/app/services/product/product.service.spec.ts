import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProductService } from './product.service';
import { environment } from '../../../environments/environment';

describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/products`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('search ส่งตัวกรองครบเป็น query param (แบรนด์หลายตัว = param ซ้ำ) และใช้หน้า 0 / 9 ชิ้นเป็นค่าเริ่มต้น', () => {
    service.search({ category: 'Notebook', brand: ['ASUS', 'Acer'], minPrice: 0, maxPrice: 30000, keyword: 'gaming' }).subscribe();
    const req = http.expectOne(r => r.url === base);
    const p = req.request.params;
    expect(p.get('page')).toBe('0');
    expect(p.get('size')).toBe('9');
    expect(p.get('category')).toBe('Notebook');
    expect(p.getAll('brand')).toEqual(['ASUS', 'Acer']);
    expect(p.get('minPrice')).toBe('0');
    expect(p.get('maxPrice')).toBe('30000');
    expect(p.get('keyword')).toBe('gaming');
    req.flush({ content: [], totalPages: 0, totalElements: 0, number: 0, size: 9 });
  });

  it('search ไม่ส่งตัวกรองที่ไม่ได้ระบุ', () => {
    service.search({ page: 2, size: 12 }).subscribe();
    const req = http.expectOne(r => r.url === base);
    expect(req.request.params.keys().sort()).toEqual(['page', 'size']);
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ content: [], totalPages: 0, totalElements: 0, number: 2, size: 12 });
  });

  it('getById เรียก /products/{id}', () => {
    service.getById(7).subscribe();
    http.expectOne(`${base}/7`).flush({});
    expect().nothing();
  });
});
