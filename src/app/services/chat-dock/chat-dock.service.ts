import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * ประสานระหว่างช่องพิมพ์ของหน้าแชท AI (ai-chat-panel — ล็อกกับขอบล่างจอ) กับแถบเปรียบเทียบที่ลอยอยู่ทุกหน้า
 * เฉพาะตอนหน้าแชทเปิด: แถบเปรียบเทียบย้ายไปอยู่เหนือช่องพิมพ์ (ซ้อนเป็นชั้น ไม่ทับกัน) และหุบเป็นแบบย่อ
 * หน้าอื่น active = false แถบเปรียบเทียบทำงานเหมือนเดิมทุกอย่าง
 */
@Injectable({ providedIn: 'root' })
export class ChatDockService {
  /** หน้าแชทเปิดอยู่ (ช่องพิมพ์ล็อกกับจอ) */
  readonly active$ = new BehaviorSubject<boolean>(false);
  /** ระยะจากขอบล่างจอถึงขอบบนของช่องพิมพ์ (รวมข้อความโควตา) — แถบเปรียบเทียบวางเหนือระยะนี้ */
  readonly dockTop$ = new BehaviorSubject<number>(0);
  /** ความสูงแถบเปรียบเทียบ (0 = ไม่มีแถบ) — หน้าแชทใช้ยกปุ่ม "ไปข้อความล่าสุด" และเผื่อที่ว่างท้ายหน้า */
  readonly compareBarHeight$ = new BehaviorSubject<number>(0);
}
