import { Component, Injectable, inject, signal } from '@angular/core';

/** ข้อความแจ้งชั่วคราวที่ต้องอยู่รอดข้ามการเปลี่ยนหน้า (เช่น ลบบัญชีแล้วพากลับหน้าแรก) — หายเองหลัง 8 วินาที */
@Injectable({ providedIn: 'root' })
export class FlashMessageService {
  static readonly DURATION_MS = 8000;
  readonly message = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string): void {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(''), FlashMessageService.DURATION_MS);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.message.set('');
  }
}

/** แถบข้อความใต้ header (role="status" ให้ screen reader อ่าน) — วางครั้งเดียวที่ app.component.html */
@Component({
  selector: 'app-flash-message',
  standalone: true,
  template: `
    <div class="flash-region" role="status" aria-live="polite">
      @if (flash.message()) {
        <div class="flash">
          <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
          <span class="flash-text">{{ flash.message() }}</span>
          <button type="button" class="flash-close" (click)="flash.dismiss()" aria-label="ปิดข้อความ">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .flash { display: flex; align-items: center; gap: 10px; margin: 12px var(--page-gutter) 0; padding: 10px 8px 10px 14px;
      border: 1px solid #b7dfc4; border-radius: 12px; background: #ecf8f0; color: #14532d; font-size: 15px; font-weight: 600; }
    .flash .material-symbols-outlined { font-size: 22px; color: #15803d; }
    .flash-text { flex: 1; }
    .flash-close { display: grid; place-items: center; width: 44px; height: 44px; margin: -8px 0; padding: 0; border: 0;
      border-radius: 50%; background: transparent; cursor: pointer; }
    .flash-close .material-symbols-outlined { font-size: 20px; color: #14532d; }
    @media (hover: hover) { .flash-close:hover { background: rgba(21, 128, 61, .1); } }
    .flash-close:focus-visible { outline: 2px solid #5b8fd6; outline-offset: 2px; }
  `]
})
export class FlashMessageComponent {
  readonly flash = inject(FlashMessageService);
}
