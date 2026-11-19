import { Component, HostListener, Injector, OnDestroy, OnInit, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthModalService, AuthView } from '../../services/auth-modal/auth-modal.service';
import { AuthService } from '../../services/authen/auth.service';
import { LoginComponent } from '../../pages/login/login.component';
import { RegisterComponent } from '../../pages/register/register.component';
import { ForgotPasswordModalComponent } from '../../forgot-password-modal/forgot-password-modal.component';
import { EmailChangeModalComponent } from '../account-modals/email-change-modal.component';
import { PasswordChangeModalComponent } from '../account-modals/password-change-modal.component';

const CLOSE_ANIM_MS = 180;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Host เดียวของ Login/Register/Forgot-password modal ทั้งระบบ
 * mount ครั้งเดียวที่ app.component.html — ไม่มี component ลูกไหนสร้าง overlay/ปุ่มปิดของตัวเองอีก
 * (login/register/forgot-password เป็น content-only ทั้งหมด — ไม่มี overlay/ปุ่มปิดของตัวเอง)
 *
 * overlay/กรอบ modal (.auth-modal-overlay/.auth-modal-box) mount ตาม "view ไม่ใช่ null หรือเปล่า" เท่านั้น
 * ไม่ถูกถอด/สร้างใหม่ตอนสลับระหว่าง view ต่าง ๆ (login -> forgot ฯลฯ) เลยไม่กะพริบ/ไม่มี overlay ซ้อน —
 * ที่ re-mount ทุกครั้งที่สลับคือแค่ .auth-modal-view (เนื้อหาข้างใน) ซึ่งมี fade สั้น ๆ ของตัวเอง
 */
@Component({
  selector: 'app-auth-modal-host',
  standalone: true,
  imports: [CommonModule, LoginComponent, RegisterComponent, ForgotPasswordModalComponent,
    EmailChangeModalComponent, PasswordChangeModalComponent],
  templateUrl: './auth-modal-host.component.html',
  styleUrl: './auth-modal-host.component.css'
})
export class AuthModalHostComponent implements OnInit, OnDestroy {
  /** view ที่ "แสดงอยู่จริง" ในเทมเพลต — ต่างจาก authModal.currentView ตรงที่จะ delay การเปลี่ยนเป็น null
   *  ไว้จนกว่า close animation จะเล่นจบ (ดู ngOnInit) */
  view: AuthView = null;
  reason: string | undefined;
  closing = false;

  private sub = new Subscription();
  /** element ที่ focus อยู่ก่อนเปิด modal (เช่นปุ่ม "เข้าสู่ระบบ") — คืน focus ให้ตอนปิด */
  private returnFocusTo: HTMLElement | null = null;

  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthService);

  constructor(private authModal: AuthModalService) {}

  ngOnInit(): void {
    this.sub.add(this.authModal.view$.subscribe(view => this.applyView(view)));
    this.sub.add(this.authModal.reason$.subscribe(r => (this.reason = r)));
    // ออกจากระบบ (รวมถึง session หมด/แท็บอื่น) ระหว่างเปิด popup หน้าโปรไฟล์ -> ปิดทิ้ง ใช้ต่อไม่ได้แล้ว
    this.sub.add(this.auth.loggedIn$.subscribe(loggedIn => {
      if (!loggedIn && this.softBox && this.authModal.currentView) this.close();
    }));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.authModal.currentView) {
      this.close();
    }
  }

  // focus trap: Tab/Shift+Tab วนอยู่ใน modal ไม่หลุดไปหน้าหลักข้างหลัง (คู่กับ aria-modal="true")
  @HostListener('document:keydown.tab', ['$event'])
  @HostListener('document:keydown.shift.tab', ['$event'])
  onTabKey(event: Event): void {
    if (!this.view || this.closing) {
      return;
    }
    const box = document.querySelector<HTMLElement>('.auth-modal-box');
    const focusables = Array.from(box?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!focusables.length) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const backwards = (event as KeyboardEvent).shiftKey;

    if (!box?.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (backwards && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!backwards && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  close(): void {
    this.authModal.close();
  }

  /** id ของหัวข้อใน view ปัจจุบัน ให้ role="dialog" มีชื่อที่ screen reader อ่านได้ */
  get labelledBy(): string | null {
    // login: ฟอร์ม (login-title) หรือข้อความแจ้งหลังผูก Google (login-linked-title) แสดงทีละอัน — id ที่ไม่มีในหน้าถูกข้าม
    return this.view === 'login' ? 'login-title login-linked-title'
      : this.view === 'register' ? 'register-title'
      : this.view === 'forgot' ? 'forgot-title'
      : this.view === 'email-change' ? 'email-change-title'
      : this.view === 'password-change' ? 'password-change-title'
      : null;
  }

  /** กรอบฟ้าอ่อนของ popup หน้าโปรไฟล์ */
  get softBox(): boolean {
    return this.view === 'email-change' || this.view === 'password-change';
  }

  // รายการโปรด/โปรไฟล์ของ user ถูกโหลดให้เองเมื่อ AuthService.loggedIn$ เปลี่ยน (ดู AppComponent) — ที่นี่แค่ปิด modal
  onLoginSuccess(): void {
    this.close();
  }

  onRegisterSuccess(): void {
    // AuthService.register() auto-login ให้แล้ว (backend ตั้ง refresh cookie แบบ session ตอนสมัครสำเร็จ)
    this.close();
  }

  private applyView(view: AuthView): void {
    if (view === null) {
      if (this.view === null) {
        return;
      }
      // ปิดจริง: เล่น fade+scale-out ก่อน ค่อยถอด content ทิ้งให้ทันอนิเมชันจบ
      this.closing = true;
      this.unlockBodyScroll();
      setTimeout(() => {
        this.view = null;
        this.closing = false;
        // คืน focus ให้ปุ่มที่เปิด modal — แต่ถ้า element นั้นหายไปแล้ว (เช่นปุ่ม "เข้าสู่ระบบ" กลายเป็นปุ่มผู้ใช้หลัง login) ก็ข้าม
        if (this.returnFocusTo?.isConnected) {
          this.returnFocusTo.focus();
        }
        this.returnFocusTo = null;
      }, CLOSE_ANIM_MS);
      return;
    }

    // เปิดใหม่ หรือสลับ view (login -> forgot ฯลฯ) — เปลี่ยนทันที ไม่หน่วง กัน overlay กะพริบ
    if (this.view === null) {
      this.returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    this.closing = false;
    this.view = view;
    this.lockBodyScroll();
    this.focusFirstField();
  }

  private lockBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = '';
  }

  // โฟกัส "ช่องกรอกแรก" ของ view ใหม่ทุกครั้งที่เปิด/สลับ — รอ 1 tick ให้ Angular render เนื้อหาใหม่ก่อน
  // หา input ในเนื้อหา (.auth-modal-view) ก่อนเสมอ ไม่งั้นปุ่มปิด X ที่อยู่ต้น DOM ของกรอบจะโดน focus แทน
  // ถ้า view นั้นไม่มี input เลย (เช่น View C2/D ที่มีแต่ปุ่ม) ค่อย fallback ไปปุ่มหลักในเนื้อหาแทน
  private focusFirstField(): void {
    // รอ render view ใหม่เสร็จก่อน (setTimeout เฉย ๆ บางครั้งยังเห็น view เก่าที่กำลังถูกถอด -> focus หลุด)
    afterNextRender(() => {
      const scope = document.querySelector<HTMLElement>('.auth-modal-view');
      // view ระบุช่องที่อยากให้ focus เองได้ด้วย data-autofocus (เช่น login ที่เติม username มาแล้ว -> ช่อง Password)
      const el = scope?.querySelector<HTMLElement>('[data-autofocus]') ?? scope?.querySelector<HTMLElement>('input, button');
      el?.focus();
    }, { injector: this.injector });
  }
}
