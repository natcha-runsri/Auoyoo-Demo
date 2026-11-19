import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Product } from '../../models/product';
import { environment } from '../../../environments/environment';
import { AuthService } from '../authen/auth.service';

/**
 * รายการโปรดของผู้ใช้ที่ล็อกอิน — ข้อมูลจริงมาจาก backend (/api/favorites) เท่านั้น
 * ไม่มีการเก็บ localStorage/mock. state แชร์ทุกที่ผ่าน favorites$ (BehaviorSubject)
 */
@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly baseUrl = `${environment.apiUrl}/favorites`;

  private readonly favoritesSubject = new BehaviorSubject<Product[]>([]);
  readonly favorites$ = this.favoritesSubject.asObservable();
  readonly count$ = this.favorites$.pipe(map(list => list.length));

  private loaded = false;
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  /** กำลังโหลดรายการจาก backend (หน้า /favorites แสดง skeleton) */
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  get favorites(): Product[] {
    return this.favoritesSubject.value;
  }

  /** ต้องล็อกอินก่อนถึงจะไลค์ได้ */
  requiresLogin(): boolean {
    return !this.auth.isLoggedIn();
  }

  isFavorite(productId: number): boolean {
    return this.favorites.some(p => p.id === productId);
  }

  isFavorite$(productId: number): Observable<boolean> {
    return this.favorites$.pipe(map(list => list.some(p => p.id === productId)));
  }

  /** โหลดรายการโปรดจาก backend (เรียกตอนแอปเปิด + หลัง login). ถ้าไม่ล็อกอินจะเคลียร์เป็น [] */
  load(force = false): void {
    if (!this.auth.isLoggedIn()) {
      this.reset();
      return;
    }
    if (this.loaded && !force) {
      return;
    }
    this.loadingSubject.next(true);
    this.http.get<Product[]>(this.baseUrl).pipe(
      catchError(() => of([] as Product[]))
    ).subscribe(list => {
      this.loaded = true;
      this.loadingSubject.next(false);
      this.favoritesSubject.next(list ?? []);
    });
  }

  /** toggle ไลค์/เลิกไลค์ — อัปเดต UI ทันที (optimistic) แล้ว sync กับ response ของ backend */
  toggle(product: Product): Observable<Product[]> {
    return this.isFavorite(product.id) ? this.remove(product.id) : this.add(product);
  }

  /** savedAt = เวลาบันทึกเดิม ("เลิกทำ" หลังลบจากหน้ารายการโปรด -> กลับไปอยู่ที่เดิม) */
  add(product: Product, savedAt?: string | null): Observable<Product[]> {
    const rollback = this.favorites;
    this.favoritesSubject.next([product, ...rollback.filter(p => p.id !== product.id)]);
    const body = savedAt ? { productId: product.id, savedAt } : { productId: product.id };
    return this.http.post<Product[]>(this.baseUrl, body).pipe(
      tap(list => this.favoritesSubject.next(list ?? [])),
      catchError(err => {
        this.favoritesSubject.next(rollback);
        throw err;
      })
    );
  }

  remove(productId: number): Observable<Product[]> {
    const rollback = this.favorites;
    this.favoritesSubject.next(rollback.filter(p => p.id !== productId));
    return this.http.delete<Product[]>(`${this.baseUrl}/${productId}`).pipe(
      tap(list => this.favoritesSubject.next(list ?? [])),
      catchError(err => {
        this.favoritesSubject.next(rollback);
        throw err;
      })
    );
  }

  /** เรียกตอน logout — ล้าง state ในหน่วยความจำ */
  reset(): void {
    this.loaded = false;
    this.favoritesSubject.next([]);
  }
}
