import { Component, DestroyRef, ElementRef, Injector, OnInit, afterNextRender, inject } from '@angular/core';
import { AsyncPipe, DOCUMENT } from '@angular/common';
import { AuthService } from '../services/authen/auth.service';
import { AuthModalService } from '../services/auth-modal/auth-modal.service';
import { DEMO_USERNAME } from './demo-backend';

/** ความสูงขั้นต่ำของแถบ (px) — ความสูงจริง (มือถือขึ้น 2 บรรทัด) วัดด้วย ResizeObserver แล้วตั้งเป็น --demo-bar-h */
const BAR_HEIGHT = 44;

/**
 * แถบเดโมขอบล่างทุกหน้า: บอกว่าเป็นข้อมูลจำลอง + ปุ่มล็อกอินเป็นผู้ใช้เดโมในคลิกเดียว
 */
@Component({
  selector: 'app-demo-banner',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <div class="demo-bar" role="region" aria-label="โหมดเดโม">
      <span class="demo-tag">DEMO</span>
      <span class="demo-text">โหมดเดโม ข้อมูลทั้งหมดเป็นข้อมูลจำลอง</span>
      @if (auth.user$ | async; as user) {
        <span class="demo-user">ใช้งานในชื่อ {{ user.username }}</span>
      } @else {
        <button type="button" class="demo-btn" (click)="tryAsUser()" [disabled]="busy">ลองเป็นผู้ใช้ทั่วไป</button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .demo-bar {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 900;
      min-height: ${BAR_HEIGHT}px; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px 12px;
      padding: 6px 16px; background: #1c316f; color: #fff;
      font-size: 13.5px; line-height: 1.4; text-align: center;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, .15);
    }
    .demo-tag {
      padding: 2px 8px; border-radius: 999px; background: #f5c542; color: #1c316f;
      font-weight: 800; font-size: 11px; letter-spacing: .08em;
    }
    .demo-user { opacity: .85; }
    .demo-btn {
      padding: 5px 14px; border: 0; border-radius: 999px; background: #fff; color: #1c316f;
      font: inherit; font-weight: 700; cursor: pointer;
    }
    .demo-btn:hover { background: #e7ecfa; }
    .demo-btn:focus-visible { outline: 2px solid #f5c542; outline-offset: 2px; }
    .demo-btn[disabled] { opacity: .6; cursor: progress; }
    @media (max-width: 600px) { .demo-bar { font-size: 12.5px; gap: 4px 8px; } }
  `]
})
export class DemoBannerComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly authModal = inject(AuthModalService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  busy = false;

  /** ให้ส่วนที่ลอยขอบล่าง (แถบเปรียบเทียบ ช่องพิมพ์แชท) และท้ายหน้า หลบแถบนี้ตามความสูงจริง */
  ngOnInit(): void {
    const root = this.document.documentElement;
    const apply = (height: number) => {
      const h = `${Math.ceil(Math.max(height, BAR_HEIGHT))}px`;
      root.style.setProperty('--demo-bar-h', h);
      this.document.body.style.paddingBottom = h;
    };
    apply(BAR_HEIGHT);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const bar = this.host.nativeElement.querySelector('.demo-bar');
        if (bar) apply(bar.getBoundingClientRect().height);
      });
      // แถบเป็น position: fixed ขนาด host จึงไม่เปลี่ยน — สังเกตตัวแถบเองหลัง render ครั้งแรก
      afterNextRender(() => {
        const bar = this.host.nativeElement.querySelector('.demo-bar');
        if (bar) observer?.observe(bar);
      }, { injector: this.injector });
    }
    this.destroyRef.onDestroy(() => {
      observer?.disconnect();
      root.style.removeProperty('--demo-bar-h');
      this.document.body.style.paddingBottom = '';
    });
  }

  /** ล็อกอินเป็นผู้ใช้เดโม (backend จำลองรับรหัสผ่านอะไรก็ได้) — ปิด popup login ถ้าเปิดค้างอยู่ */
  tryAsUser(): void {
    if (this.busy) return;
    this.busy = true;
    this.auth.login(DEMO_USERNAME, 'demo', false).subscribe({
      next: () => {
        this.busy = false;
        this.authModal.close();
      },
      error: () => (this.busy = false)
    });
  }
}
