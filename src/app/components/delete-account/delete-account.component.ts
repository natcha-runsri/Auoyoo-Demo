import { Component, Input, OnDestroy, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TimeoutError, finalize } from 'rxjs';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AccountService } from '../../services/account/account.service';
import { AuthService } from '../../services/authen/auth.service';
import { CompareService } from '../../services/compare/compare.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';
import { FlashMessageService } from '../flash-message/flash-message.component';
import { ResendCountdown, retryAfterSeconds } from '../account-modals/resend-countdown';

/** คำที่ต้องพิมพ์ก่อนลบได้ — ตรงกับ AccountSecurityService.DELETE_CONFIRMATION ฝั่ง backend */
export const DELETE_CONFIRMATION = 'ลบบัญชี';
export const ACCOUNT_DELETED_MESSAGE = 'ลบบัญชีเรียบร้อยแล้ว ข้อมูลทั้งหมดของคุณถูกลบออกจากระบบแล้ว';

/**
 * โซนอันตรายท้ายหน้าโปรไฟล์: ลบบัญชีถาวร (PDPA) ผ่าน ConfirmDialog ตัวเดิม
 *   พิมพ์ "ลบบัญชี" + รหัสผ่านปัจจุบัน หรือรหัสยืนยันทางอีเมล (บัญชี Google ที่ไม่มีรหัสผ่าน)
 *   สำเร็จ -> ออกจากระบบทุกแท็บ, ล้างรายการเปรียบเทียบในเบราว์เซอร์, กลับหน้าแรก + ข้อความแจ้ง
 *   (ไม่ล้างโควตา AI ของผู้ไม่ล็อกอิน — ไม่ใช่ข้อมูลบัญชี และล้างแล้วจะได้โควตาฟรีเพิ่ม)
 */
@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent],
  templateUrl: './delete-account.component.html',
  styleUrl: './delete-account.component.css'
})
export class DeleteAccountComponent implements OnDestroy {
  /** อีเมลของบัญชี (บอกว่าจะส่งรหัสไปที่ไหน) */
  @Input() email = '';
  /** false = บัญชีที่สมัครด้วย Google และยังไม่ได้ตั้งรหัสผ่าน -> ยืนยันด้วยรหัสทางอีเมล */
  @Input() hasPassword = true;

  private readonly account = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly compare = inject(CompareService);
  private readonly profiles = inject(UserProfileService);
  private readonly flash = inject(FlashMessageService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  readonly confirmWord = DELETE_CONFIRMATION;
  open = false;
  typed = '';
  password = '';
  code = '';
  codeSentTo = '';
  sendingCode = false;
  deleting = false;
  error = '';
  readonly countdown = new ResendCountdown();

  get canDelete(): boolean {
    return this.typed.trim() === DELETE_CONFIRMATION
      && (this.hasPassword ? this.password.length > 0 : /^\d{6}$/.test(this.code));
  }

  ngOnDestroy(): void {
    this.countdown.stop();
  }

  openDialog(): void {
    this.open = true;
    this.typed = this.password = this.code = this.error = '';
  }

  cancel(): void {
    if (this.deleting) return;
    this.open = false;
  }

  sendCode(): void {
    if (this.sendingCode || this.countdown.seconds) return;
    this.sendingCode = true;
    this.error = '';
    this.account.requestDeleteCode().pipe(finalize(() => (this.sendingCode = false))).subscribe({
      next: sent => {
        this.codeSentTo = sent.sentTo;
        this.countdown.start(sent.resendAfterSeconds);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 429) this.countdown.start(retryAfterSeconds(err));
        this.error = errorMessage(err);
      }
    });
  }

  /** ช่องรหัสยืนยัน: เก็บเฉพาะตัวเลข (วางรหัสที่มีช่องว่าง/ขีดมาก็ได้) */
  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.code = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = this.code;
  }

  /** Enter ในช่องกรอก = กดยืนยัน (เมื่อกรอกครบ) */
  submitOnEnter(event: Event): void {
    event.preventDefault();
    if (this.canDelete) this.confirmDelete();
  }

  confirmDelete(): void {
    if (!this.canDelete || this.deleting) return;
    this.deleting = true;
    this.error = '';
    const body = this.hasPassword
      ? { confirmation: this.typed.trim(), password: this.password }
      : { confirmation: this.typed.trim(), code: this.code };
    this.account.deleteAccount(body).pipe(finalize(() => (this.deleting = false))).subscribe({
      next: () => this.afterDeleted(),
      error: (err: unknown) => {
        this.error = errorMessage(err);
        if (this.hasPassword) this.password = ''; // กรอกใหม่
      }
    });
  }

  private afterDeleted(): void {
    this.open = false;
    this.auth.endSessionAfterAccountDeleted();
    this.profiles.clear();
    this.compare.clear(); // localStorage compareList
    void this.router.navigate(['/']).then(() => {
      // router ไม่เลื่อนให้เอง (มาจากโซนลบบัญชีท้ายหน้าโปรไฟล์) — ขึ้นบนสุดให้เห็นข้อความใต้ header
      this.document.defaultView?.scrollTo({ top: 0, behavior: 'auto' });
      this.flash.show(ACCOUNT_DELETED_MESSAGE);
    });
  }
}

/** ข้อความภาษาไทยของ error — backend ส่ง message ภาษาไทยมาแล้วเกือบทุกกรณี ใช้ตามนั้นพร้อมจำนวนครั้งที่เหลือ */
function errorMessage(err: unknown): string {
  if (err instanceof TimeoutError) {
    return 'เซิร์ฟเวอร์ไม่ตอบกลับภายในเวลาที่กำหนด กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง';
  }
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ บัญชียังไม่ถูกลบ กรุณาลองใหม่อีกครั้ง';
    const body = err.error as { message?: unknown; attemptsLeft?: unknown } | null;
    const message = typeof body?.message === 'string' && body.message && err.status < 500 ? body.message : '';
    if (message) {
      return typeof body?.attemptsLeft === 'number' ? `${message} (เหลืออีก ${body.attemptsLeft} ครั้ง)` : message;
    }
  }
  return 'ลบบัญชีไม่สำเร็จ บัญชียังไม่ถูกลบ กรุณาลองใหม่อีกครั้ง';
}
