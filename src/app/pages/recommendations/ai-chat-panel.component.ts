import {
  AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Inject, Input, NgZone, OnChanges, OnDestroy, OnInit,
  Output, SimpleChanges, ViewChild
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ProductCardComponent } from '../category/product-card/product-card.component';
import { ChatMessage } from './recommendations.component';
import { ChatDockService } from '../../services/chat-dock/chat-dock.service';
import { DOCK_GAP_PX } from '../../components/compare-bar/compare-bar.component';
import { Subscription } from 'rxjs';

/** ช่องพิมพ์ขยายตามข้อความได้ไม่เกินนี้ (เกินแล้วเลื่อนในช่อง) — มือถือจอเล็กเหลือ 4 */
const MAX_INPUT_LINES = 5;
const MAX_INPUT_LINES_COMPACT = 4;
/** จอเล็กกว่านี้ = ช่องพิมพ์แบบกะทัดรัด (1 บรรทัด, placeholder สั้น) — ตรงกับ @media (max-width: 599px) ใน CSS */
export const COMPACT_INPUT_QUERY = '(max-width: 599px)';
export const INPUT_PLACEHOLDER = 'พิมพ์บอกความต้องการ เช่น โน้ตบุ๊กเล่นเกม งบไม่เกิน 30,000 บาท';
export const INPUT_PLACEHOLDER_COMPACT = 'พิมพ์ความต้องการ เช่น งบ 30,000';
/** อยู่ห่างก้นรายการข้อความไม่เกินนี้ (px) = ถือว่ากำลังดูข้อความล่าสุด -> เลื่อนตามข้อความใหม่ */
export const NEAR_BOTTOM_PX = 120;
/** จอเตี้ยลงอย่างน้อยเท่านี้ (px) ขณะโฟกัสช่องพิมพ์ = แป้นพิมพ์เปิด (แถบ address bar มือถือยุบ/โผล่ ~60px ไม่นับ) */
export const KEYBOARD_MIN_PX = 120;
/** class บน <body> ตอนหน้าแชทเปิด — ทั้งหน้าสูงพอดีจอ ไม่เลื่อน และซ่อน footer (styles.css) */
export const CHAT_DOCK_BODY_CLASS = 'ai-chat-docked';

/**
 * หน้าตาของแชท AI แนะนำสินค้า (แสดงผลอย่างเดียว — ตรรกะทั้งหมดอยู่ที่ RecommendationsComponent)
 *  - ยังไม่เริ่มแชท: โลโก้ + หัวข้อ + คำอธิบาย + ปุ่มแนะนำอัตโนมัติ (กล่องสูงพอดีจอ)
 *  - กำลังแชท: ฟองข้อความ AI (ซ้าย) / ผู้ใช้ (ขวา, รูปโปรไฟล์จริง) + การ์ดสินค้าแถวเลื่อนแนวนอน
 *    หน้าเว็บไม่เลื่อน (body.ai-chat-docked) — เลื่อนเฉพาะ component นี้ (:host) แบบแอปแชท
 *  - แถบกรมท่าท้ายจอ + ช่องพิมพ์ล็อกกับจอ (position: fixed) ข้อความเลื่อนผ่านใต้ช่องพิมพ์
 *    ช่องพิมพ์ textarea: Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่, ขยายขึ้นด้านบนได้ไม่เกิน 5 บรรทัด
 *  - ข้อความใหม่ -> เลื่อนลงล่างสุด เว้นแต่ผู้ใช้เลื่อนขึ้นไปอ่านอยู่ (มีปุ่ม "ไปข้อความล่าสุด" แทน)
 *  - มือถือ: แป้นพิมพ์เปิด -> ยกช่องพิมพ์ขึ้นเหนือแป้นพิมพ์ (visualViewport) และแจ้ง keyboardChange ให้หน้าแชทซ่อนแถบหัวหน้า
 *  - มีสินค้าในแถบเปรียบเทียบ: แถบย้ายมาอยู่เหนือช่องพิมพ์ (ChatDockService) — ปุ่ม "ไปข้อความล่าสุด"
 *    และที่ว่างท้ายหน้ายกขึ้นตามความสูงแถบ
 */
@Component({
  selector: 'app-ai-chat-panel',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './ai-chat-panel.component.html',
  styleUrl: './ai-chat-panel.component.css',
  host: {
    '[style.--kb-offset]': "keyboardOffset + 'px'", '[style.--compare-stack]': "compareStack + 'px'",
    '[style.--dock-space]': "dockSpace ? dockSpace + 'px' : null"
  }
})
export class AiChatPanelComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  @Input() messages: ChatMessage[] = [];
  @Input() loading = false;
  @Input() isLoggedIn = false;
  @Input() guestRemaining = 0;
  @Input() guestQuotaMax = 5;
  @Input() userAvatar = 'images/default-avatar.svg';
  @Input() maxLength = 300;
  @Input() input = '';

  @Output() inputChange = new EventEmitter<string>();
  @Output() send = new EventEmitter<void>();
  @Output() auto = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() login = new EventEmitter<void>();
  /** แป้นพิมพ์มือถือเปิด/ปิด (ส่งเฉพาะตอนเปลี่ยน) */
  @Output() keyboardChange = new EventEmitter<boolean>();

  @ViewChild('box') private box?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('wrap') private set wrapRef(ref: ElementRef<HTMLElement> | undefined) {
    this.wrapObserver?.disconnect();
    this.wrapEl = ref?.nativeElement;
    if (this.wrapEl && typeof ResizeObserver !== 'undefined') {
      this.wrapObserver = new ResizeObserver(() => this.zone.run(() => this.publishDockTop()));
      this.wrapObserver.observe(this.wrapEl);
    }
  }

  avatarFailed = false;
  /** จอ < 600px: ช่องพิมพ์ 1 บรรทัด + placeholder สั้น */
  compactInput = false;
  readonly placeholder = INPUT_PLACEHOLDER;
  readonly placeholderCompact = INPUT_PLACEHOLDER_COMPACT;
  /** ผู้ใช้เลื่อนขึ้นไปอ่านข้อความเก่า -> แสดงปุ่ม "ไปข้อความล่าสุด" */
  showJumpToLatest = false;
  /** ความสูงที่แป้นพิมพ์มือถือบังจอด้านล่าง (px) — ยกแถบ + ช่องพิมพ์ขึ้นเท่านี้ */
  keyboardOffset = 0;
  /** ความสูงแถบเปรียบเทียบที่ซ้อนอยู่เหนือช่องพิมพ์ + ระยะห่าง (0 = ไม่มีแถบ) */
  compareStack = 0;
  /** ระยะจากขอบล่างจอถึงขอบบนช่องพิมพ์ (รวมข้อความโควตา) — เผื่อที่ว่างท้ายรายการข้อความเท่านี้ (0 = ยังไม่ได้วัด) */
  dockSpace = 0;
  private wrapEl?: HTMLElement;
  private compareBarHeight = 0;
  /** ข้อความโควตาที่ลอยเหนือกรอบช่องพิมพ์ (จอใหญ่) สูงเกินขอบบนกรอบเท่าไร — แถบเปรียบเทียบอยู่เหนือส่วนนี้ด้วย */
  private quotaAbove = 0;
  private wrapObserver?: ResizeObserver;
  /** กล่องข้อความสูงขึ้น/เตี้ยลง (แถบหัวหน้าซ่อน/แสดง, จอเปลี่ยนขนาด) -> ยังเห็นข้อความล่าสุด */
  private hostObserver?: ResizeObserver;
  private keyboardOpen = false;
  /** ความสูง visualViewport สูงสุดที่เคยเห็นที่ความกว้างนี้ = จอตอนไม่มีแป้นพิมพ์ (Android ย่อทั้งหน้าแทนการบัง) */
  private viewportBase = { width: 0, height: 0 };
  private dockSub?: Subscription;
  private stickToBottom = true;
  private pendingScroll = false;
  /** กำลังเลื่อนแบบ smooth ไปล่างสุด (ปุ่ม) — ระหว่างทางยังไม่ถึงก้นหน้า ไม่ให้ปุ่มโผล่กลับมา */
  private jumping = false;
  private jumpTimer?: ReturnType<typeof setTimeout>;
  private readonly onViewportChange = () => this.zone.run(() => this.updateKeyboardOffset());
  private compactQuery?: MediaQueryList;
  private readonly onCompactChange = (e: MediaQueryListEvent) => this.zone.run(() => this.setCompact(e.matches));

  constructor(@Inject(DOCUMENT) private document: Document, private zone: NgZone, private chatDock: ChatDockService,
              private host: ElementRef<HTMLElement>) {}

  /** ยังไม่เริ่มแชท = มีแค่ข้อความทักทายของบอท (ไม่แสดงฟองทักทายซ้ำกับหัวข้อ) */
  get started(): boolean {
    return this.messages.length > 1 || this.loading;
  }

  get quotaOut(): boolean {
    return !this.isLoggedIn && this.guestRemaining <= 0;
  }

  get canSend(): boolean {
    return !this.loading && !!this.input.trim() && !this.quotaOut;
  }

  ngOnInit(): void {
    this.document.body.classList.add(CHAT_DOCK_BODY_CLASS);
    this.chatDock.active$.next(true);
    this.dockSub = this.chatDock.compareBarHeight$.subscribe(h => {
      this.compareBarHeight = h;
      this.updateCompareStack();
    });
    this.compactQuery = this.document.defaultView?.matchMedia?.(COMPACT_INPUT_QUERY);
    this.compactInput = !!this.compactQuery?.matches;
    this.compactQuery?.addEventListener?.('change', this.onCompactChange);
    const vv = this.document.defaultView?.visualViewport;
    if (vv) this.viewportBase = { width: vv.width, height: vv.height };
    vv?.addEventListener('resize', this.onViewportChange);
    vv?.addEventListener('scroll', this.onViewportChange);
    if (typeof ResizeObserver !== 'undefined') {
      this.hostObserver = new ResizeObserver(() => this.zone.run(() => this.keepLatestInView()));
      this.hostObserver.observe(this.host.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove(CHAT_DOCK_BODY_CLASS);
    this.document.body.style.removeProperty('--chat-dock-extra');
    this.dockSub?.unsubscribe();
    this.wrapObserver?.disconnect();
    this.hostObserver?.disconnect();
    this.compactQuery?.removeEventListener?.('change', this.onCompactChange);
    this.chatDock.dockTop$.next(0);
    this.chatDock.active$.next(false);
    this.document.defaultView?.visualViewport?.removeEventListener('resize', this.onViewportChange);
    this.document.defaultView?.visualViewport?.removeEventListener('scroll', this.onViewportChange);
    clearTimeout(this.jumpTimer);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages'] || changes['loading']) this.pendingScroll = true;
    if (changes['userAvatar']) this.avatarFailed = false;
    if (changes['input']) queueMicrotask(() => this.autoGrow());
  }

  /** ข้อความใหม่ -> เลื่อนลงล่างสุด เว้นแต่ผู้ใช้เลื่อนขึ้นไปอ่านข้อความเก่าอยู่ */
  ngAfterViewChecked(): void {
    if (!this.pendingScroll) return;
    this.pendingScroll = false;
    if (!this.started) return;
    if (this.stickToBottom) {
      this.scrollToBottom('auto');
    } else {
      this.updateScrollState();
    }
  }

  @HostListener('scroll')
  onScroll(): void {
    this.updateScrollState();
    this.publishDockTop();
  }

  /** จอเปลี่ยนขนาด (หมุนจอ / แป้นพิมพ์ Android ย่อหน้าจอ) -> ถ้าดูข้อความล่าสุดอยู่ ให้ยังเห็นข้อความล่าสุด */
  @HostListener('window:resize')
  onResize(): void {
    this.keepLatestInView();
    this.onScroll();
  }

  /** ปุ่ม "ไปข้อความล่าสุด" */
  jumpToLatest(): void {
    this.stickToBottom = true;
    this.showJumpToLatest = false;
    this.jumping = true;
    clearTimeout(this.jumpTimer);
    this.jumpTimer = setTimeout(() => (this.jumping = false), 1200);
    const reduced = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.scrollToBottom(reduced ? 'auto' : 'smooth');
  }

  onInput(event: Event): void {
    this.inputChange.emit((event.target as HTMLTextAreaElement).value);
    this.autoGrow();
  }

  onKeydown(event: KeyboardEvent): void {
    // ระหว่างพิมพ์ภาษาไทยด้วย IME ยังไม่ส่ง
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    if (!this.canSend) return;
    // ส่งเอง = อยากเห็นคำตอบ -> ตามไปล่างสุดแม้เลื่อนขึ้นไปอ่านอยู่
    this.stickToBottom = true;
    this.send.emit();
  }

  private scrollToBottom(behavior: ScrollBehavior): void {
    const el = this.host.nativeElement;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  private updateScrollState(): void {
    const el = this.host.nativeElement;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    if (this.jumping) {
      if (distance > NEAR_BOTTOM_PX) return; // ยังเลื่อนไม่ถึง
      this.jumping = false;
    }
    this.stickToBottom = distance <= NEAR_BOTTOM_PX;
    this.showJumpToLatest = this.started && !this.stickToBottom;
  }

  /**
   * แป้นพิมพ์มือถือ (จาก visualViewport):
   *  - iOS: แป้นพิมพ์บังส่วนล่างของ layout viewport -> keyboardOffset = ส่วนที่ถูกบัง (ยกช่องพิมพ์ขึ้น)
   *  - Android (interactive-widget=resizes-content): ทั้งหน้าเตี้ยลงแทน keyboardOffset จึงเป็น 0 -> ดูจากจอที่เตี้ยลง
   * เปิด/ปิด -> keyboardChange (หน้าแชทซ่อน/แสดงแถบหัวหน้า)
   */
  private updateKeyboardOffset(): void {
    const win = this.document.defaultView;
    const vv = win?.visualViewport;
    if (!win || !vv) return;
    this.keyboardOffset = Math.max(0, Math.round(win.innerHeight - vv.height - vv.offsetTop));
    if (vv.width !== this.viewportBase.width) this.viewportBase = { width: vv.width, height: vv.height }; // หมุนจอ
    this.viewportBase.height = Math.max(this.viewportBase.height, vv.height);
    const active = this.document.activeElement;
    const typing = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
    const open = typing && (this.keyboardOffset >= KEYBOARD_MIN_PX || this.viewportBase.height - vv.height >= KEYBOARD_MIN_PX);
    if (open !== this.keyboardOpen) {
      this.keyboardOpen = open;
      this.keyboardChange.emit(open);
    }
    // ช่องพิมพ์ขยับตามแป้นพิมพ์หลังรอบ render นี้ -> วัดใหม่รอบถัดไป (ที่ว่างท้ายรายการเปลี่ยนตาม)
    queueMicrotask(() => {
      this.publishDockTop();
      this.keepLatestInView();
    });
  }

  private keepLatestInView(): void {
    if (this.started && this.stickToBottom && !this.jumping) this.scrollToBottom('auto');
  }

  /** ปุ่ม "ไปข้อความล่าสุด" + ที่ว่างท้ายหน้า ยกขึ้นเท่าแถบเปรียบเทียบ (และข้อความโควตาที่แถบหลบ) */
  private updateCompareStack(): void {
    this.compareStack = this.compareBarHeight > 0 ? this.compareBarHeight + DOCK_GAP_PX + this.quotaAbove : 0;
    // styles.css: body.ai-chat-docked เผื่อที่ว่างท้ายหน้าเพิ่มเท่านี้
    this.document.body.style.setProperty('--chat-dock-extra', `${this.compareStack}px`);
  }

  /** ระยะจากขอบล่างจอถึงขอบบนของช่องพิมพ์ -> แถบเปรียบเทียบวางเหนือระยะนี้ */
  private publishDockTop(): void {
    const win = this.document.defaultView;
    if (!win || !this.wrapEl) return;
    // จอใหญ่ข้อความโควตาลอยอยู่เหนือกรอบช่องพิมพ์ (absolute) — นับรวมด้วย แถบเปรียบเทียบจะได้ไม่บัง
    const tops = [this.wrapEl, ...Array.from(this.wrapEl.querySelectorAll<HTMLElement>('.quota'))]
      .map(e => e.getBoundingClientRect().top);
    const top = Math.max(0, Math.round(win.innerHeight - Math.min(...tops)));
    if (top !== this.dockSpace) {
      this.dockSpace = top;
      // ช่องพิมพ์สูงขึ้น (พิมพ์หลายบรรทัด) -> ที่ว่างท้ายรายการเพิ่มหลัง render นี้ แล้วค่อยตามลงไป ข้อความล่าสุดไม่ถูกทับ
      setTimeout(() => this.keepLatestInView());
    }
    this.quotaAbove = Math.max(0, Math.round(this.wrapEl.getBoundingClientRect().top - Math.min(...tops)));
    this.updateCompareStack();
    if (top !== this.chatDock.dockTop$.value) this.chatDock.dockTop$.next(top);
  }

  /** หมุนจอ/ย่อขยายหน้าต่างข้าม 600px -> จำนวนบรรทัดเริ่มต้นเปลี่ยน วัดความสูงใหม่หลัง render */
  private setCompact(compact: boolean): void {
    this.compactInput = compact;
    setTimeout(() => this.autoGrow());
  }

  /** textarea สูงตามข้อความ ไม่เกิน 5 บรรทัด (มือถือ 4) แล้วเลื่อนในช่อง (ช่องพิมพ์ยึดขอบล่าง จึงขยายขึ้นด้านบน) */
  private autoGrow(): void {
    const el = this.box?.nativeElement;
    if (!el) return;
    const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 22;
    const maxLines = this.compactInput ? MAX_INPUT_LINES_COMPACT : MAX_INPUT_LINES;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, line * maxLines + 4)}px`;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
