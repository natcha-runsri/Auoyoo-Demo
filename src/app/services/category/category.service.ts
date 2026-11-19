import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../../models/category';
import { environment } from '../../../environments/environment';

export interface BrandCount {
  brand: string;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  constructor(private http: HttpClient) {}

  getCategoryTree(): Observable<Category[]> {
    return this.http.get<Category[]>(this.baseUrl);
  }

  getBrands(categoryKey: string): Observable<BrandCount[]> {
    const params = new HttpParams().set('categoryKey', categoryKey);
    return this.http.get<BrandCount[]>(`${this.baseUrl}/brands`, { params });
  }
}
