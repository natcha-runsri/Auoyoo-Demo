import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, TimeoutError } from 'rxjs';
import {
  AI_MAX_MESSAGE_LENGTH, RecommendService, RecommendationCriteria, RecommendationResponse
} from '../../services/recommend/recommend.service';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { Product } from '../../models/product';
import { UserProfileService } from '../../services/user-profile/user-profile.service';
import { DEFAULT_AVATAR } from '../../components/user-menu/user-menu.component';
import { AiChatPanelComponent } from './ai-chat-panel.component';
import { ComparePageComponent } from './compare/compare-page.component';
import { GUEST_QUOTA_MAX, guestRemaining, recordGuestUse } from '../../services/recommend/ai-guest-quota';

/** ข้อความหนึ่งรายการในแชท AI แนะนำสินค้า (โหมด default ของหน้านี้) */
export interface ChatMessage {
  role: 'bot' | 'user';
  text?: string;
  products?: Product[];
}

/**
 * รหัสแชทแบบ UUID v4 — crypto.randomUUID ใช้ได้เฉพาะ secure context (https / localhost)
 * ทางสำรองใช้ crypto.getRandomValues (มีในทุกเบราว์เซอร์ที่ Angular รองรับ ใช้ได้แม้ไม่ใช่ https) — ไม่ใช้ Math.random
 */
export function newChatId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AiChatPanelComponent, ComparePageComponent],
  templateUrl: './recommendations.component.html',
  styleUrl: './recommendations.component.css'
})
export class RecommendationsComponent implements OnInit, OnDestroy {
  mode: 'compare' | 'empty' = 'empty';
  /** ?ids= ของโหมดเปรียบเทียบ (หน้าเปรียบเทียบอ่านจาก URL อย่างเดียว ไม่ผูกกับแถบเปรียบเทียบ) */
  compareIds: number[] = [];

  // ---- AI แนะนำสินค้า (mode default / 'empty') ----
  // โควตา guest ใช้ร่วมกับหน้าเปรียบเทียบ (ai-guest-quota.ts)
  readonly guestQuotaMax = GUEST_QUOTA_MAX;
  readonly maxMessageLength = AI_MAX_MESSAGE_LENGTH;

  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatLoading = false;
  /** แป้นพิมพ์มือถือเปิด (จาก ai-chat-panel) -> พับแถบหัวหน้า (จอ < 1024px) */
  keyboardOpen = false;
  isLoggedIn = false;
  guestRemaining = this.guestQuotaMax;

  // เงื่อนไขที่ backend ใช้ค้นในคำตอบล่าสุด — ส่งกลับไปกับข้อความถัดไป ("หูฟัง" -> "งบไม่เกิน 2000" ยังเป็นหูฟัง)
  // backend เป็นคนรวม/ตรวจเงื่อนไขเอง หน้านี้แค่เก็บแล้วส่งคืน
  private chatContext: RecommendationCriteria | null = null;
  /** รหัสแชทนี้ (สุ่มใหม่ทุกครั้งที่เริ่มแชท) — backend เก็บบทสนทนาของผู้ที่ล็อกอินไว้อ่านย้อนหลังที่หน้าประวัติ */
  private chatId = newChatId();
  /** คำค้นจาก navbar ที่มาระหว่าง AI ยังตอบข้อความก่อนหน้าไม่เสร็จ — ส่งต่อทันทีที่ตอบเสร็จ */
  private pendingQuery: string | null = null;

  private authSub?: Subscription;
  private profileSub?: Subscription;
  /** รูปโปรไฟล์ผู้ใช้ในฟองข้อความ (รูปเดียวกับ navbar; guest/ไม่มีรูป = รูปเริ่มต้น) — เปลี่ยนรูปแล้วตามทันที */
  userAvatar = DEFAULT_AVATAR;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recommendService: RecommendService,
    private authService: AuthService,
    private authModal: AuthModalService,
    private userProfile: UserProfileService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.authSub = this.authService.loggedIn$.subscribe(loggedIn => this.isLoggedIn = loggedIn);
    this.profileSub = this.userProfile.currentUser$.subscribe(user => this.userAvatar = user?.avatarUrl || DEFAULT_AVATAR);
    this.guestRemaining = guestRemaining();

    this.route.queryParams.subscribe(params => {
      const idsRaw = (params['ids'] ?? '').toString().trim();
      const q = (params['q'] ?? '').toString().trim();

      if (idsRaw) {
        const ids = idsRaw.split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isInteger(n) && n > 0);
        if (ids.length) {
          this.mode = 'compare';
          this.compareIds = ids;
        } else {
          this.mode = 'empty';
          this.initChat();
        }
      } else {
        this.mode = 'empty';
        this.initChat();
        if (q) this.askFromUrl(q);
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.profileSub?.unsubscribe();
  }

  // ---- AI แนะนำสินค้า ----

  private initChat(): void {
    if (this.chatMessages.length > 0) {
      return;
    }
    this.chatMessages.push({
      role: 'bot',
      text: 'สวัสดีครับ วันนี้อยากให้เราช่วยแนะนำอุปกรณ์แบบไหนหรอครับ'
    });
  }

  /** เริ่มแชทใหม่ — ล้างทั้งข้อความและเงื่อนไขเดิม ข้อความถัดไปจึงไม่ถูกตีความต่อจากหัวข้อเก่า (ไม่คืนโควตา guest) */
  newChat(): void {
    if (this.chatLoading) {
      return; // กันคำตอบของ request ที่ค้างอยู่ไปโผล่ในแชทใหม่
    }
    this.chatMessages = [];
    this.chatInput = '';
    this.chatContext = null;
    this.chatId = newChatId();
    this.initChat();
  }

  /**
   * ?q=คำค้น (ช่องค้นหา navbar / กดรายการในหน้าประวัติ) -> ส่งเป็นข้อความในแชทเหมือนผู้ใช้พิมพ์เอง
   * ต่อท้ายแชทเดิม ไม่ล้างแชท แล้วลบ ?q= ออกจาก URL (replaceUrl) -> รีเฟรชแล้วไม่ส่งซ้ำ
   */
  private askFromUrl(q: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (this.chatLoading) {
      this.pendingQuery = q;
      return;
    }
    this.sendText(q);
  }

  canUseAi(): boolean {
    return this.isLoggedIn || this.guestRemaining > 0;
  }

  sendQuery(): void {
    this.sendText(this.chatInput);
  }

  private sendText(raw: string): void {
    const text = raw.trim();
    if (!text || this.chatLoading) {
      return;
    }
    if (!this.canUseAi()) {
      // โควตา guest หมด: เก็บข้อความไว้ในช่องพิมพ์ ล็อกอินแล้วกดส่งต่อได้เลย
      this.chatInput = text;
      this.requireLoginForAi();
      return;
    }
    this.chatMessages.push({ role: 'user', text });
    this.chatInput = '';
    this.chatLoading = true;
    this.recommendService.query(text, this.chatContext, this.chatId).subscribe({
      next: res => this.handleAiResponse(res),
      error: err => this.handleAiError(err)
    });
  }

  autoRecommend(): void {
    if (this.chatLoading) {
      return;
    }
    if (!this.canUseAi()) {
      this.requireLoginForAi();
      return;
    }
    this.chatMessages.push({ role: 'user', text: 'แนะนำอัตโนมัติ' });
    // ผลอัตโนมัติไม่ได้มาจากเงื่อนไขที่ผู้ใช้พิมพ์ — ข้อความถัดไปเริ่มนับใหม่ ไม่ต่อจากหัวข้อก่อนหน้า
    this.chatContext = null;
    this.chatLoading = true;
    this.recommendService.getAuto(this.chatId).subscribe({
      next: res => this.handleAiResponse(res),
      error: err => this.handleAiError(err)
    });
  }

  requireLoginForAi(): void {
    this.authModal.open('login', { reason: 'เข้าสู่ระบบเพื่อใช้งาน AI แนะนำสินค้าต่อ' });
  }

  private handleAiResponse(res: RecommendationResponse): void {
    this.chatLoading = false;
    this.sendPendingAfter(() => this.showAiResponse(res));
  }

  private showAiResponse(res: RecommendationResponse): void {
    this.recordGuestUsage();
    // ได้ criteria = backend ค้นจริงตามเงื่อนไขนี้ -> ใช้ต่อ; ไม่ได้ (ถามกลับ/ไม่เข้าใจ) -> เก็บของเดิมไว้ ผู้ใช้ตอบต่อจากหัวข้อเดิมได้
    if (res.criteria) {
      this.chatContext = res.criteria;
    }

    if (!res.understood) {
      this.chatMessages.push({ role: 'bot', text: res.message ?? 'ไม่เข้าใจคำขอ กรุณาระบุประเภทสินค้า' });
      return;
    }
    // message = ข้อความแจ้งคงที่จาก backend (เช่น "ไม่พบแบรนด์ X ในระบบ...") แสดงก่อนคำอธิบายของ AI
    const text = [res.message, res.narration].filter(Boolean).join('\n\n');
    this.chatMessages.push({ role: 'bot', text, products: res.products });
  }

  private handleAiError(err: unknown): void {
    this.chatLoading = false;
    this.sendPendingAfter(() => this.chatMessages.push({ role: 'bot', text: this.aiErrorText(err) }));
  }

  /** แสดงคำตอบก่อน แล้วค่อยส่งคำค้นที่รอคิวอยู่ (ถ้ามี) — ลำดับในแชทจึงเป็น ถาม-ตอบ-ถาม */
  private sendPendingAfter(show: () => void): void {
    show();
    const next = this.pendingQuery;
    this.pendingQuery = null;
    if (next) this.sendText(next);
  }

  /** ข้อความแจ้งผู้ใช้ตามชนิด error — ใช้ข้อความภาษาไทยจาก backend ถ้ามี (429/503/400 ส่ง message มาให้แล้ว) */
  private aiErrorText(err: unknown): string {
    if (err instanceof TimeoutError) {
      return 'AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่อีกครั้ง';
    }
    if (!(err instanceof HttpErrorResponse)) {
      return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
    }
    const serverMessage = typeof err.error?.message === 'string' ? err.error.message : null;
    switch (err.status) {
      case 0:
        return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง';
      case 400:
        return serverMessage ?? 'คำขอไม่ถูกต้อง กรุณาลองพิมพ์ใหม่อีกครั้ง';
      case 429:
        return serverMessage ?? 'คุณใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
      case 503:
        return serverMessage ?? 'บริการ AI ไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง';
      default:
        return 'บริการ AI ไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง';
    }
  }

  private recordGuestUsage(): void {
    if (!this.isLoggedIn) {
      this.guestRemaining = recordGuestUse();
    }
  }
}
