import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CategoryService } from './category.service';
import { environment } from '../../../environments/environment';

describe('CategoryService', () => {
  let service: CategoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CategoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getCategoryTree เรียก /categories', () => {
    let result: unknown;
    service.getCategoryTree().subscribe(tree => (result = tree));
    const req = http.expectOne(`${environment.apiUrl}/categories`);
    expect(req.request.method).toBe('GET');
    req.flush([{ name: 'อุปกรณ์ทั้งหมด', count: 1, children: [] }]);
    expect(result).toEqual([{ name: 'อุปกรณ์ทั้งหมด', count: 1, children: [] }]);
  });

  it('getBrands ส่ง categoryKey เป็น query param', () => {
    service.getBrands('Computer Set,Computer / PC').subscribe();
    const req = http.expectOne(r => r.url === `${environment.apiUrl}/categories/brands`);
    expect(req.request.params.get('categoryKey')).toBe('Computer Set,Computer / PC');
    req.flush([]);
  });
});
