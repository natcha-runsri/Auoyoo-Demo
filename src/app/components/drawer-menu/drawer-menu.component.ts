import { Component, DestroyRef, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output,
  SimpleChanges, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/authen/auth.service';
import { LogoutConfirmComponent } from '../confirm-dialog/logout-confirm.component';

/**
 * แผงเมนูด้านข้างจากปุ่ม ☰ (จอเล็กกว่า 1024px) — เมนูหลัก + เมนูบัญชี (โปรไฟล์/ประวัติ/ออกจากระบบ หรือเข้าสู่ระบบ)
 * ใช้แบบ <app-drawer-menu [(open)]="menuOpen" [returnFocusTo]="menuButton"> — ปิดเองเมื่อกดปุ่ม X, คลิกนอกแผง,
 * Esc, เลือกเมนู หรือเปลี่ยนหน้า แล้วคืนโฟกัสให้ returnFocusTo (ปุ่ม ☰)
 */
@Component({
  selector: 'app-drawer-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, LogoutConfirmComponent],
  templateUrl: './drawer-menu.component.html',
  styleUrl: './drawer-menu.component.css'
})
export class DrawerMenuComponent implements OnInit, OnChanges, OnDestroy {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  /** ปุ่มที่เปิดแผง — ได้โฟกัสคืนตอนปิด */
  @Input() returnFocusTo?: HTMLElement;

  /** popup ยืนยันออกจากระบบ (แสดงหลังปิดแผงแล้ว) */
  confirmingLogout = false;

  @ViewChild('drawerClose') private drawerClose?: ElementRef<HTMLButtonElement>;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  get loggedIn(): boolean { return this.auth.isLoggedIn(); }

  ngOnInit(): void {
    // เปลี่ยนหน้า (รวมกดลิงก์ในแผง/ปุ่มย้อนกลับ) -> ปิดแผง
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.close(false));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.document.body.classList.add('drawer-open'); // ล็อกการเลื่อนหน้าหลังแผง (styles.css)
      setTimeout(() => this.drawerClose?.nativeElement.focus());
    }
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('drawer-open');
  }

  /** @param restoreFocus คืนโฟกัสให้ปุ่ม ☰ (ปิดเอง) — เปลี่ยนหน้าแล้วไม่ต้อง */
  close(restoreFocus = true): void {
    if (!this.open) return;
    this.open = false;
    this.openChange.emit(false);
    this.document.body.classList.remove('drawer-open');
    if (restoreFocus) setTimeout(() => this.returnFocusTo?.focus());
  }

  /** ปิดแผงก่อน แล้วค่อยถามยืนยัน (popup โฟกัสปุ่มยกเลิกเอง จึงไม่คืนโฟกัสให้ ☰ ตอนนี้) */
  logout(): void {
    this.close(false);
    this.confirmingLogout = true;
  }

  /** ยกเลิกหรือยืนยันแล้ว (LogoutConfirmComponent เรียก AuthService.logout() เอง) -> โฟกัสกลับปุ่ม ☰ */
  onLogoutConfirmClosed(): void {
    this.confirmingLogout = false;
    setTimeout(() => this.returnFocusTo?.focus());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
