import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse, Product } from '../../models/product';
import { CompareTable } from '../../models/compare';
import { environment } from '../../../environments/environment';

export interface ProductFilter {
  category?: string;
  brand?: string[];
  minPrice?: number;
  maxPrice?: number;
  keyword?: string;   // เพิ่มใหม่
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly baseUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  search(filter: ProductFilter): Observable<PageResponse<Product>> {
    let params = new HttpParams()
      .set('page', (filter.page ?? 0).toString())
      .set('size', (filter.size ?? 9).toString());

    if (filter.category) {
      params = params.set('category', filter.category);
    }
    if (filter.brand && filter.brand.length) {
      for (const b of filter.brand) {
        params = params.append('brand', b);
      }
    }
    if (filter.minPrice != null) {
      params = params.set('minPrice', filter.minPrice.toString());
    }
    if (filter.maxPrice != null) {
      params = params.set('maxPrice', filter.maxPrice.toString());
    }
    if (filter.keyword) {
      params = params.set('keyword', filter.keyword);   // เพิ่มใหม่ — ปรับชื่อ param ตามที่ backend รับจริง
    }

    return this.http.get<PageResponse<Product>>(this.baseUrl, { params });
  }

  /** รายละเอียดสินค้าชิ้นเดียว — GET /api/products/:id */
  /** ราคาต่ำสุด/สูงสุดจริงของหมวด (category คั่นด้วย , / ไม่ระบุ = ทุกหมวด) — null = ไม่มีสินค้าที่มีราคา */
  getPriceRange(category?: string | null): Observable<{ min: number | null; max: number | null }> {
    const params = category ? new HttpParams().set('category', category) : new HttpParams();
    return this.http.get<{ min: number | null; max: number | null }>(`${this.baseUrl}/price-range`, { params });
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  /** ดึงหลายสินค้าเพื่อเปรียบเทียบ — GET /api/products/compare?ids=1,2,3 (backend คืนตามลำดับ ids) */
  compare(ids: number[]): Observable<Product[]> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http.get<Product[]>(`${this.baseUrl}/compare`, { params });
  }

  /** ตารางเปรียบเทียบ (สเปกแยกเป็นหัวข้อ + ค่าที่ดีที่สุด) — GET /api/products/compare-table?ids=1,2,3 ไม่เรียก AI */
  compareTable(ids: number[]): Observable<CompareTable> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http.get<CompareTable>(`${this.baseUrl}/compare-table`, { params });
  }
}