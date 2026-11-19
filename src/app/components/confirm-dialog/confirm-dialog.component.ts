import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * กล่องยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ (ใช้ตอน "ลบประวัติทั้งหมด" และ "ออกจากระบบ" ผ่าน LogoutConfirmComponent)
 * role="alertdialog" (เปลี่ยนได้ด้วย dialogRole) + focus เริ่มที่ปุ่มยกเลิก, Tab วนอยู่ในกล่อง,
 * Esc/คลิกด้านนอก = ยกเลิก (ยกเว้นระหว่างทำงาน)
 * variant="cream" = กรอบครีมตามธีม navbar (ปุ่มยืนยันแดง #e5343b เดียวกับเมนูออกจากระบบ)
 * ใส่ช่องกรอกเพิ่มได้ (ng-content อยู่ใต้คำอธิบาย) + confirmDisabled ปิดปุ่มยืนยันจนกรอกครบ (ใช้ตอนลบบัญชี)
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay" [class.cream]="variant === 'cream'" (click)="!busy && cancelled.emit()">
      <div class="box" [attr.role]="dialogRole" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc"
        (click)="$event.stopPropagation()" (keydown)="onKeydown($event)">
        <span class="material-symbols-outlined icon" aria-hidden="true">{{ icon }}</span>
        <h2 id="confirm-title">{{ title }}</h2>
        <p id="confirm-desc">{{ message }}</p>
        <ng-content></ng-content>
        <p class="error" role="alert">{{ error }}</p>
        <div class="actions">
          <button #cancelButton type="button" class="btn btn-ghost" (click)="cancelled.emit()" [disabled]="busy">ยกเลิก</button>
          <button type="button" class="btn btn-danger" (click)="confirmed.emit()" [disabled]="busy || confirmDisabled"
            [attr.aria-busy]="busy">
            <span class="spinner" *ngIf="busy" aria-hidden="true"></span>
            {{ busy ? busyLabel : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, .35); }
    .box { width: min(400px, 100%); padding: 26px 26px 22px; box-sizing: border-box; border-radius: 14px; background: #fff;
      text-align: center; box-shadow: 0 16px 40px rgba(15, 23, 42, .25); font-family: 'Noto Sans Thai', 'Inter', sans-serif; }
    .icon { font-size: 40px; color: #9a3f1e; }
    h2 { margin: 6px 0; font-size: 19px; color: #1c316f; }
    p { margin: 0; font-size: 14px; color: #5b6576; }
    .error { min-height: 18px; margin: 8px 0 4px; font-size: 13px; color: #c0392b; }
    .actions { display: flex; justify-content: center; gap: 10px; margin-top: 8px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 110px; height: 40px; padding: 0 16px;
      border-radius: 8px; font-family: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; }
    .btn-ghost { border: 1px solid #c9d6ea; background: #fff; color: #1c316f; }
    .btn-danger { border: 0; background: #d32f2f; color: #fff; }
    @media (hover: hover) { .btn-danger:hover:not(:disabled) { background: #b71c1c; } }
    .btn:disabled { opacity: .7; cursor: progress; }
    .btn:focus-visible { outline: 2px solid #5b8fd6; outline-offset: 2px; }
    @media (max-width: 1023px) { .btn { height: 44px; } }
    .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .35); border-top-color: #fff;
      animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .cream { background: rgba(12, 30, 60, .45); }
    .cream .box { width: min(380px, 100%); padding: 28px 24px 24px; border-radius: 20px; background: #FFFCF5;
      box-shadow: 0 16px 40px rgba(12, 30, 60, .28); }
    .cream .icon { font-size: 44px; color: #e5343b; }
    .cream h2 { margin: 8px 0 6px; font-size: 20px; font-weight: 800; }
    .cream p { font-size: 15px; color: #1c316f; }
    .cream .error:empty { display: none; }
    .cream .actions { gap: 12px; margin-top: 22px; }
    .cream .btn { flex: 1; min-width: 0; height: 44px; border-radius: 12px; font-size: 15px; font-weight: 700; }
    .cream .btn-ghost { border: 1px solid #cfc8b8; background: transparent; color: #4b5563; }
    .cream .btn-danger { background: #e5343b; }
    @media (hover: hover) {
      .cream .btn-ghost:hover:not(:disabled) { background: #ece8dd; }
      .cream .btn-danger:hover:not(:disabled) { background: #c92a31; }
    }
  `]
})
export class ConfirmDialogComponent implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() title = '';
  @Input() message = '';
  @Input() icon = 'delete_forever';
  @Input() confirmLabel = 'ยืนยัน';
  @Input() busyLabel = 'กำลังดำเนินการ...';
  @Input() busy = false;
  @Input() error = '';
  @Input() dialogRole: 'alertdialog' | 'dialog' = 'alertdialog';
  @Input() variant: 'default' | 'cream' = 'default';
  /** ปิดปุ่มยืนยันไว้ก่อน (เช่น ยังพิมพ์คำยืนยันไม่ถูก) */
  @Input() confirmDisabled = false;
  /** โฟกัสแรก: ปุ่มยกเลิก (ค่าเริ่มต้น) หรือช่องกรอกแรกใน ng-content */
  @Input() initialFocus: 'cancel' | 'content' = 'cancel';
  @Output() confirmed = new EventEmitter<void>(); // ไม่ใช้ชื่อ confirm/cancel: ชนกับชื่อ DOM event (cancel ของ <dialog>)
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('cancelButton') private cancelButton?: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    const field = this.initialFocus === 'content'
      ? this.host.nativeElement.querySelector<HTMLElement>('.box input:not([disabled])') : null;
    (field ?? this.cancelButton?.nativeElement)?.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!this.busy) this.cancelled.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    // ปุ่มและช่องกรอก (ng-content) — วน Tab อยู่ในกล่อง
    const buttons = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    if (!buttons.length) {
      event.preventDefault();
      return;
    }
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
  }
}
