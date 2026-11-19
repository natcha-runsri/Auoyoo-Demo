import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { Product } from '../../models/product';
import { CompareAnalysis } from '../../models/compare';
import { environment } from '../../../environments/environment';

/** เงื่อนไขที่ backend ใช้ค้นจริง — ส่งกลับไปเป็น context ของข้อความถัดไป (backend ตรวจซ้ำทุกครั้ง หน้าเว็บไม่ต้องแก้ค่า) */
export interface RecommendationCriteria {
  category: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  brand: string | null;
  /** ชื่อ persona จาก backend (เช่น "PROGRAMMER") — ส่งคืนอย่างเดียว ไม่ตีความฝั่งหน้าเว็บ */
  persona?: string | null;
  /** คุณสมบัติที่ใช้จัดอันดับ (เช่น ["GAMING"]) — ส่งคืนอย่างเดียว ข้อความถัดไปที่ไม่บอกคุณสมบัติ backend ใช้ชุดเดิมต่อ */
  features?: string[] | null;
}

export interface RecommendationResponse {
  understood: boolean;
  reason: string | null;
  message: string | null;
  narration: string | null;
  products: Product[];
  /** null เมื่อ backend ไม่ได้ค้น (ถามกลับ / ไม่เข้าใจ / โหมด auto) */
  criteria?: RecommendationCriteria | null;
}

/** ความยาวข้อความสูงสุด — ต้องตรงกับ app.recommend.max-message-length ฝั่ง backend */
export const AI_MAX_MESSAGE_LENGTH = 300;

// backend รอคิว LLM ได้ถึง llm.queue-wait-ms (30 วิ) แล้วเรียก LLM ได้ถึง llm.timeout-ms (120 วิ) = แย่สุด 150 วิ
// เผื่อไว้อีก 30 วิ กันหน้าแชทตัดทิ้งก่อน backend ตอบ และกันค้าง loading ถ้า response ไม่กลับมาเลย
const AI_REQUEST_TIMEOUT_MS = 180_000;

@Injectable({ providedIn: 'root' })
export class RecommendService {
  private readonly baseUrl = `${environment.apiUrl}/recommend`;

  constructor(private http: HttpClient) {}

  /**
   * โหมด 1 — ผู้ใช้พิมพ์ความต้องการเอง; context = criteria จากคำตอบก่อนหน้าในแชทเดียวกัน (ข้อความแรก = null)
   * chatId = รหัสแชทนี้ — ผู้ที่ล็อกอินถูกเก็บบทสนทนาไว้อ่านย้อนหลังที่หน้าประวัติ
   */
  query(message: string, context: RecommendationCriteria | null = null, chatId: string | null = null): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(`${this.baseUrl}/query`, { message, context, chatId })
      .pipe(timeout(AI_REQUEST_TIMEOUT_MS));
  }

  /** ผลวิเคราะห์หน้าเปรียบเทียบ — backend เก็บผลไว้ต่อชุดสินค้า, refresh = วิเคราะห์ใหม่ */
  compareAnalysis(ids: number[], refresh = false): Observable<CompareAnalysis> {
    return this.http.post<CompareAnalysis>(`${this.baseUrl}/compare-analysis`, { ids, refresh })
      .pipe(timeout(AI_REQUEST_TIMEOUT_MS));
  }

  /** ถามเพิ่มเกี่ยวกับสินค้าชุดที่เปรียบเทียบ */
  compareAsk(ids: number[], question: string): Observable<{ answer: string }> {
    return this.http.post<{ answer: string }>(`${this.baseUrl}/compare-ask`, { ids, question })
      .pipe(timeout(AI_REQUEST_TIMEOUT_MS));
  }

  /** โหมด 2 — แนะนำอัตโนมัติ ไม่ต้องพิมพ์ */
  getAuto(chatId: string | null = null): Observable<RecommendationResponse> {
    const options = chatId ? { params: { chatId } } : {};
    return this.http.get<RecommendationResponse>(`${this.baseUrl}/auto`, options)
      .pipe(timeout(AI_REQUEST_TIMEOUT_MS));
  }
}
