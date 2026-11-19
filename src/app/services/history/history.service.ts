import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../authen/auth.service';
import { Product } from '../../models/product';

export type HistoryType = 'SEARCH' | 'VIEW';
export type HistoryFilter = 'all' | 'search' | 'view';
export type AnalysisRange = 7 | 30;

export interface HistoryItem {
  id: number;
  type: HistoryType;
  /** AI = ช่องค้นหา navbar / แชท AI, CATEGORY = ช่องค้นหาหน้าหมวดหมู่, PRODUCT = หน้าสินค้า, COMPARE = หน้าเปรียบเทียบ */
  source: 'AI' | 'CATEGORY' | 'PRODUCT' | 'COMPARE';
  /** คำค้น หรือชื่อสินค้า */
  title: string;
  productId: number | null;
  category: string | null;
  /** เวลาไทย "HH:mm" */
  time: string;
  createdAt: string;
  /** รหัสสินค้าที่เปรียบเทียบ (source COMPARE) */
  compareIds?: number[] | null;
  /** ชื่อสินค้าที่เปรียบเทียบ คั่นด้วย " / " (source COMPARE) */
  detail?: string | null;
  /** แชท AI ที่เก็บบทสนทนาไว้ (เปิดอ่านได้อย่างเดียว) — null = ไม่มีบทสนทนา (ค้นใหม่แทน) */
  chatId?: number | null;
  /** จำนวนคำถามของแชทนี้ในวันนั้น (title = คำถามแรก) */
  questionCount?: number | null;
}

/** ข้อความ 1 รายการของแชทที่บันทึกไว้ — products = สินค้า ณ ตอนที่ AI ตอบ */
export interface SavedChatMessage {
  role: 'user' | 'bot';
  text: string | null;
  products: Product[];
  createdAt: string;
}

export interface SavedChat {
  id: number;
  startedAt: string;
  updatedAt: string;
  messages: SavedChatMessage[];
}

export interface HistoryDay {
  date: string;
  items: HistoryItem[];
}

export interface Slice {
  key: string;
  label: string;
  count: number;
  /** จำนวนเต็ม รวมทุกชิ้นได้ 100 */
  percent: number;
}

export interface HistorySummary {
  from: string;
  to: string;
  rangeDays: AnalysisRange;
  categoryTotal: number;
  categories: Slice[];
  priceTotal: number;
  priceRanges: Slice[];
}

/**
 * ประวัติการค้นหา/เข้าชม (หน้า /history) — backend บันทึก/อ่านเฉพาะของผู้ใช้ที่ล็อกอินอยู่
 * การค้นหาผ่าน AI (ช่องค้นหา navbar / แชทแนะนำ) backend บันทึกเอง ไม่ต้องเรียกจากที่นี่
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/history`;

  getDay(date: string): Observable<HistoryDay> {
    return this.http.get<HistoryDay>(this.baseUrl, { params: { date } });
  }

  getSummary(date: string, range: AnalysisRange): Observable<HistorySummary> {
    return this.http.get<HistorySummary>(`${this.baseUrl}/summary`, { params: new HttpParams().set('date', date).set('range', range) });
  }

  /** วันที่ (yyyy-MM-dd) ในเดือนนั้นที่มีประวัติ — month = "yyyy-MM" */
  getActiveDays(month: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/days`, { params: { month } });
  }

  /** บทสนทนากับ AI ที่บันทึกไว้ (อ่านอย่างเดียว) — แชทของคนอื่น/ถูกลบแล้ว = 404 */
  getChat(id: number): Observable<SavedChat> {
    return this.http.get<SavedChat>(`${this.baseUrl}/chats/${id}`);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  deleteAll(): Observable<void> {
    return this.http.delete<void>(this.baseUrl);
  }

  /** ค้นหาจากหน้าหมวดหมู่ — บันทึกเฉพาะตอนล็อกอิน ยิงแล้วลืม (พลาดก็ไม่กระทบการค้นหา) */
  recordSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed || !this.auth.isLoggedIn()) return;
    this.http.post<void>(`${this.baseUrl}/searches`, { query: trimmed }).subscribe({ error: () => undefined });
  }

  /** เปิดหน้าเปรียบเทียบ — บันทึกเฉพาะตอนล็อกอิน ยิงแล้วลืม (backend ไม่บันทึกชุดเดิมซ้ำภายใน 30 นาที) */
  recordCompare(productIds: number[]): void {
    if (productIds.length < 2 || !this.auth.isLoggedIn()) return;
    this.http.post<void>(`${this.baseUrl}/compares`, { productIds }).subscribe({ error: () => undefined });
  }

  /** เปิดหน้ารายละเอียดสินค้า — บันทึกเฉพาะตอนล็อกอิน ยิงแล้วลืม */
  recordView(productId: number): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.post<void>(`${this.baseUrl}/views`, { productId }).subscribe({ error: () => undefined });
  }
}
