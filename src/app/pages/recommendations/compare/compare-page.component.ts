import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, TimeoutError } from 'rxjs';
import { ProductService } from '../../../services/product/product.service';
import { RecommendService } from '../../../services/recommend/recommend.service';
import { CompareService } from '../../../services/compare/compare.service';
import { HistoryService } from '../../../services/history/history.service';
import { AuthService } from '../../../services/authen/auth.service';
import { AuthModalService } from '../../../services/auth-modal/auth-modal.service';
import { GUEST_QUOTA_MAX, guestRemaining, recordGuestUse } from '../../../services/recommend/ai-guest-quota';
import { CompareAnalysis, CompareTable } from '../../../models/compare';
import { CompareCardsComponent } from './compare-cards.component';
import { AnalysisState, CompareSummaryComponent } from './compare-summary.component';
import { CompareTableComponent } from './compare-table.component';
import { AskMessage, CompareAskComponent } from './compare-ask.component';

/**
 * หน้าเปรียบเทียบสินค้า /recommendations?ids=1,2,3 (อ่านจาก URL อย่างเดียว)
 *  (A) การ์ดสินค้า  (B) สรุปโดย AI  (C) ตารางสเปก  (D) ถาม AI เพิ่ม
 * ตาราง (ไม่ใช้ AI) กับผลวิเคราะห์โหลดแยกกัน — ตารางไม่ต้องรอ AI, AI ล้มตารางยังแสดง
 * โควตา guest ใช้ร่วมกับแชท AI: การวิเคราะห์อัตโนมัติครั้งแรก (และ "ลองใหม่" ของครั้งนั้น) ไม่นับ,
 * "วิเคราะห์ใหม่" และคำถามเพิ่มนับครั้งละ 1
 */
@Component({
  selector: 'app-compare-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CompareCardsComponent, CompareSummaryComponent, CompareTableComponent, CompareAskComponent],
  templateUrl: './compare-page.component.html',
  styleUrl: './compare-page.component.css'
})
export class ComparePageComponent implements OnInit, OnChanges, OnDestroy {
  @Input() ids: number[] = [];

  table: CompareTable | null = null;
  tableLoading = false;
  tableError = '';

  analysis: CompareAnalysis | null = null;
  analysisState: AnalysisState = 'off';
  /** การวิเคราะห์ที่กำลังทำเป็นแบบ "วิเคราะห์ใหม่" (กดเอง) หรือไม่ — ลองใหม่หลังล้มจะทำแบบเดิม */
  private lastRefresh = false;

  askMessages: AskMessage[] = [];
  askLoading = false;

  isLoggedIn = false;
  guestRemaining = GUEST_QUOTA_MAX;
  readonly guestQuotaMax = GUEST_QUOTA_MAX;

  private tableSub?: Subscription;
  private analysisSub?: Subscription;
  private askSub?: Subscription;
  private authSub?: Subscription;

  constructor(
    private productService: ProductService,
    private recommendService: RecommendService,
    private compareService: CompareService,
    private history: HistoryService,
    private auth: AuthService,
    private authModal: AuthModalService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn();
    this.guestRemaining = guestRemaining();
    this.authSub = this.auth.loggedIn$.subscribe(v => (this.isLoggedIn = v));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ids']) this.load();
  }

  ngOnDestroy(): void {
    [this.tableSub, this.analysisSub, this.askSub, this.authSub].forEach(s => s?.unsubscribe());
  }

  get count(): number {
    return this.table?.products.length ?? this.ids.length;
  }

  get canUseAi(): boolean {
    return this.isLoggedIn || this.guestRemaining > 0;
  }

  get recommendedId(): number | null {
    return this.analysis?.recommendation?.id ?? null;
  }

  // ===================== โหลด =====================

  private load(): void {
    this.table = null;
    this.analysis = null;
    this.askMessages = [];
    this.askSub?.unsubscribe();
    this.askLoading = false;
    this.loadTable();
    if (this.ids.length >= 2) {
      this.runAnalysis(false);
    } else {
      this.analysisSub?.unsubscribe();
      this.analysisState = 'off';
    }
  }

  loadTable(): void {
    this.tableSub?.unsubscribe();
    this.tableLoading = true;
    this.tableError = '';
    this.tableSub = this.productService.compareTable(this.ids).subscribe({
      next: table => {
        this.table = table;
        this.tableLoading = false;
        // ประวัติ "เปรียบเทียบ N รายการ" — เฉพาะตอนล็อกอิน (service เช็กเอง)
        if (table.products.length >= 2) this.history.recordCompare(table.products.map(p => p.product.id));
      },
      error: err => {
        this.tableLoading = false;
        const message = err instanceof HttpErrorResponse && typeof err.error?.message === 'string' ? err.error.message : null;
        this.tableError = err instanceof HttpErrorResponse && err.status === 404 && message ? message : 'โหลดข้อมูลเปรียบเทียบไม่สำเร็จ';
      }
    });
  }

  private runAnalysis(refresh: boolean): void {
    this.analysisSub?.unsubscribe();
    this.lastRefresh = refresh;
    this.analysisState = 'loading';
    this.analysisSub = this.recommendService.compareAnalysis(this.ids, refresh).subscribe({
      next: analysis => {
        this.analysis = analysis;
        this.analysisState = 'ok';
      },
      error: () => {
        this.analysis = null;
        this.analysisState = 'error';
      }
    });
  }

  /** ปุ่ม "วิเคราะห์ใหม่" — นับโควตา guest */
  reanalyze(): void {
    if (this.analysisState === 'loading') return;
    if (!this.useQuota()) return;
    this.runAnalysis(true);
  }

  /** ปุ่ม "ลองใหม่" หลังวิเคราะห์ไม่สำเร็จ — ทำแบบเดิมซ้ำ ไม่นับโควตาเพิ่ม */
  retryAnalysis(): void {
    if (this.analysisState !== 'loading') this.runAnalysis(this.lastRefresh);
  }

  // ===================== ถามเพิ่ม =====================

  ask(question: string): void {
    const text = question.trim();
    if (!text || this.askLoading || this.ids.length < 2) return;
    if (!this.useQuota()) return;
    this.askMessages = [...this.askMessages, { role: 'user', text }];
    this.askLoading = true;
    this.askSub = this.recommendService.compareAsk(this.ids, text).subscribe({
      next: res => {
        this.askLoading = false;
        this.askMessages = [...this.askMessages, { role: 'bot', text: res.answer }];
      },
      error: err => {
        this.askLoading = false;
        this.askMessages = [...this.askMessages, { role: 'bot', text: this.askErrorText(err), error: true }];
      }
    });
  }

  /** ล็อกอินแล้วใช้ได้ไม่จำกัด; guest นับ 1 ครั้ง, หมดแล้วเปิด popup ล็อกอิน */
  private useQuota(): boolean {
    if (this.isLoggedIn) return true;
    if (this.guestRemaining <= 0) {
      this.requireLogin();
      return false;
    }
    this.guestRemaining = recordGuestUse();
    return true;
  }

  requireLogin(): void {
    this.authModal.open('login', { reason: 'เข้าสู่ระบบเพื่อใช้งาน AI แนะนำสินค้าต่อ' });
  }

  private askErrorText(err: unknown): string {
    if (err instanceof TimeoutError) return 'AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่อีกครั้ง';
    if (err instanceof HttpErrorResponse) {
      const message = typeof err.error?.message === 'string' ? err.error.message : null;
      if (err.status === 0) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง';
      if ((err.status === 400 || err.status === 429) && message) return message;
    }
    return 'ตอบคำถามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
  }

  // ===================== เอาสินค้าออก =====================

  /** X บนการ์ด: เอาออกจากหน้านี้ (แก้ ?ids=) และออกจากแถบเปรียบเทียบด้วยถ้าอยู่ในนั้น */
  remove(id: number): void {
    const rest = this.ids.filter(i => i !== id);
    if (this.compareService.isInCompare(id)) this.compareService.remove(id);
    void this.router.navigate(['/recommendations'], { queryParams: rest.length ? { ids: rest.join(',') } : {}, replaceUrl: true });
  }
}
