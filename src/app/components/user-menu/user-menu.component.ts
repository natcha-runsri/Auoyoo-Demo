import { Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { CurrentUser, UserProfileService } from '../../services/user-profile/user-profile.service';
import { LogoutConfirmComponent } from '../confirm-dialog/logout-confirm.component';

export const DEFAULT_AVATAR = 'images/default-avatar.svg';

/**
 * ปุ่มมุมขวาบนของ navbar
 *  - ยังไม่ login: ปุ่ม "เข้าสู่ระบบ" กดแล้วเปิด login popup ทันที
 *  - login แล้ว: ปุ่มแคปซูล (ชื่อ + รูปโปรไฟล์) กดแล้วเปิด dropdown เมนูผู้ใช้ (WAI-ARIA menu button pattern:
 *    ลูกศรขึ้น/ลง/Home/End เลื่อน, Enter เลือก, Esc/Tab/คลิกข้างนอก ปิด)
 */
@Component({
  selector: 'app-user-menu', standalone: true, imports: [CommonModule, LogoutConfirmComponent],
  templateUrl: './user-menu.component.html', styleUrl: './user-menu.component.css'
})
export class UserMenuComponent implements OnInit, OnDestroy {
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @ViewChildren('menuItem') menuItems?: QueryList<ElementRef<HTMLButtonElement>>;
  user: CurrentUser | null = null;
  open = false;
  /** popup ยืนยันออกจากระบบ */
  confirmingLogout = false;
  avatarFailed = false;
  private sub = new Subscription();

  constructor(private auth: AuthService, private users: UserProfileService, private authModal: AuthModalService,
              private router: Router, private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.sub.add(this.users.currentUser$.subscribe(user => {
      this.user = user;
      this.avatarFailed = false;
    }));
    // ออกจากระบบด้วยวิธีใดก็ตาม (รวมถึง session หมดอายุ/แท็บอื่น) -> ปิดเมนูค้าง
    this.sub.add(this.auth.loggedIn$.subscribe(loggedIn => { if (!loggedIn) this.open = false; }));
  }
  ngOnDestroy(): void { this.sub.unsubscribe(); }

  get loggedIn(): boolean { return this.auth.isLoggedIn(); }
  get displayName(): string { return this.user?.username || this.auth.getUsername() || ''; }
  get avatarSrc(): string { return (!this.avatarFailed && this.user?.avatarUrl) || DEFAULT_AVATAR; }

  onTriggerClick(): void {
    if (!this.loggedIn) {
      this.authModal.open('login');
      return;
    }
    this.open ? this.close() : this.openMenu(0);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (!this.loggedIn) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.openMenu(event.key === 'ArrowDown' ? 0 : -1);
    }
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const items = this.menuItems?.toArray().map(ref => ref.nativeElement) ?? [];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); items[(current + 1) % items.length]?.focus(); break;
      case 'ArrowUp': event.preventDefault(); items[(current - 1 + items.length) % items.length]?.focus(); break;
      case 'Home': event.preventDefault(); items[0]?.focus(); break;
      case 'End': event.preventDefault(); items[items.length - 1]?.focus(); break;
      case 'Tab': this.close(); break; // ปล่อยให้ focus ไปต่อตามปกติ
    }
  }

  close(refocus = false): void {
    this.open = false;
    if (refocus) setTimeout(() => this.trigger?.nativeElement.focus());
  }

  navigate(path: '/profile' | '/history'): void { this.close(); void this.router.navigate([path]); }

  // ถามยืนยันก่อน — LogoutConfirmComponent เรียก AuthService.logout() (API logout + ล้างสถานะ + ออกจากหน้าที่ต้อง login)
  // (รายการโปรด/โปรไฟล์ถูกล้างให้เองเมื่อ loggedIn$ เปลี่ยน ดู AppComponent)
  logout(): void { this.close(); this.confirmingLogout = true; }

  /** ยกเลิกหรือยืนยันแล้ว -> โฟกัสกลับปุ่มผู้ใช้ (หลังออกจากระบบคือปุ่ม "เข้าสู่ระบบ" ตัวเดียวกัน) */
  onLogoutConfirmClosed(): void {
    this.confirmingLogout = false;
    setTimeout(() => this.trigger?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape') onEscape(): void { if (this.open) this.close(true); }
  @HostListener('document:click', ['$event']) onDocumentClick(event: MouseEvent): void {
    if (this.open && !(event.target instanceof Node && this.host.nativeElement.contains(event.target))) this.close();
  }

  /** index -1 = รายการสุดท้าย */
  private openMenu(focusIndex: number): void {
    this.open = true;
    // รอ 1 tick ให้ dropdown render ก่อนค่อย focus รายการแรก/สุดท้าย
    setTimeout(() => {
      const items = this.menuItems?.toArray() ?? [];
      items[focusIndex < 0 ? items.length - 1 : focusIndex]?.nativeElement.focus();
    });
  }
}
