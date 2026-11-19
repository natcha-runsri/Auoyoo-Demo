import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../../models/product';

const STORAGE_KEY = 'compareList';

/**
 * เก็บ "รายการเปรียบเทียบ" ไว้ที่ฝั่ง client (localStorage) — persist ข้ามหน้า/ข้าม session
 * ไม่ต้อง login. state แชร์ผ่าน BehaviorSubject ตาม pattern เดียวกับ FavoriteService
 */
@Injectable({ providedIn: 'root' })
export class CompareService {
  /** จำนวนสินค้าสูงสุดที่เปรียบเทียบพร้อมกันได้ */
  readonly max = 4;

  private readonly itemsSubject = new BehaviorSubject<Product[]>(this.readStorage());
  readonly items$ = this.itemsSubject.asObservable();
  readonly count$ = this.items$.pipe(map(items => items.length));

  /** ยิงทุกครั้งที่มีสินค้า "ใหม่" ถูกเพิ่มเข้า list — ใช้สั่งให้ compare bar กางออก */
  private readonly addedSubject = new Subject<Product>();
  readonly added$ = this.addedSubject.asObservable();

  constructor() {
    // sync ข้ามแท็บ/ข้าม instance: ถ้า localStorage ถูกแก้จากที่อื่น (เพิ่ม/ลบ/ล้างทั้งหมด)
    // ให้ list ในแท็บนี้ตามไปด้วย กัน state ค้างเมื่อเปิดหลายแท็บหรือหลัง hot-reload
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEY || event.key === null) {
          const next = this.readStorage();
          if (!this.sameList(next, this.itemsSubject.value)) {
            this.itemsSubject.next(next);
          }
        }
      });
    }
  }

  get items(): Product[] {
    return this.itemsSubject.value;
  }

  isInCompare(productId: number): boolean {
    return this.items.some(p => p.id === productId);
  }

  isInCompare$(productId: number): Observable<boolean> {
    return this.items$.pipe(map(items => items.some(p => p.id === productId)));
  }

  isFull$(): Observable<boolean> {
    return this.count$.pipe(map(c => c >= this.max));
  }

  /** toggle: อยู่ใน list แล้ว -> เอาออก, ยังไม่อยู่ -> เพิ่ม (ถ้ายังไม่เต็ม). คืน true ถ้าตอนนี้อยู่ใน list */
  toggle(product: Product): boolean {
    if (this.isInCompare(product.id)) {
      this.remove(product.id);
      return false;
    }
    return this.add(product);
  }

  /** เพิ่มสินค้า. คืน false ถ้า list เต็มแล้ว */
  add(product: Product): boolean {
    if (this.isInCompare(product.id)) {
      return true;
    }
    if (this.items.length >= this.max) {
      return false;
    }
    this.commit([...this.items, product]);
    this.addedSubject.next(product);
    return true;
  }

  remove(productId: number): void {
    this.commit(this.items.filter(p => p.id !== productId));
  }

  clear(): void {
    this.commit([]);
  }

  private commit(items: Product[]): void {
    this.itemsSubject.next(items);
    this.writeStorage(items);
  }

  private sameList(a: Product[], b: Product[]): boolean {
    return a.length === b.length && a.every((p, i) => p.id === b[i]?.id);
  }

  private readStorage(): Product[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(p => p && typeof p.id === 'number') : [];
    } catch {
      return [];
    }
  }

  private writeStorage(items: Product[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage เต็ม/ปิดใช้งาน — ปล่อยผ่าน ยังทำงานใน memory ได้ */
    }
  }
}
