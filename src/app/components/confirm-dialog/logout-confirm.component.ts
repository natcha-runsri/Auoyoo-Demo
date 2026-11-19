import { Component, EventEmitter, Output, inject } from '@angular/core';
import { AuthService } from '../../services/authen/auth.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';

/**
 * popup ยืนยันก่อนออกจากระบบ — ใช้ทั้งในแผงเมนู ☰ (drawer-menu) และ dropdown รูปโปรไฟล์ (user-menu) ให้เหมือนกันทุกอย่าง
 * ยืนยัน = AuthService.logout() ตัวเดิม; ยกเลิก/คลิกพื้นหลัง/Esc = ปิดเฉย ๆ — ทั้งสองกรณี emit closed ให้คนเปิดถอด popup
 */
@Component({
  selector: 'app-logout-confirm',
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    <app-confirm-dialog variant="cream" dialogRole="dialog" icon="logout" title="ออกจากระบบ?"
      message="คุณต้องการออกจากระบบใช่หรือไม่" confirmLabel="ออกจากระบบ"
      (confirmed)="confirm()" (cancelled)="closed.emit()"></app-confirm-dialog>
  `
})
export class LogoutConfirmComponent {
  @Output() closed = new EventEmitter<void>();
  private readonly auth = inject(AuthService);

  confirm(): void {
    this.auth.logout();
    this.closed.emit();
  }
}
