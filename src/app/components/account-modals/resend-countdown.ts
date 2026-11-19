import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';

const DEFAULT_SECONDS = 60;

/**
 * นับถอยหลังก่อนกด "ส่งรหัสอีกครั้ง" ได้ (ใช้ใน popup หน้าโปรไฟล์) — ต้องเรียก stop() ตอน component ถูกทำลาย
 */
export class ResendCountdown {
  seconds = 0;
  private sub?: Subscription;

  get label(): string {
    const m = Math.floor(this.seconds / 60);
    const s = (this.seconds % 60).toString().padStart(2, '0');
    return `ส่งอีกครั้งได้ใน ${m}:${s}`;
  }

  start(seconds = DEFAULT_SECONDS): void {
    this.stop();
    this.seconds = Math.max(0, Math.ceil(seconds));
    if (!this.seconds) return;
    this.sub = timer(1000, 1000).subscribe(() => {
      this.seconds = Math.max(0, this.seconds - 1);
      if (!this.seconds) this.stop();
    });
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }
}

/** วินาทีที่ต้องรอจาก header Retry-After ของ 429 */
export function retryAfterSeconds(err: HttpErrorResponse): number {
  const seconds = Number(err.headers?.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_SECONDS;
}

export function genericError(err: HttpErrorResponse): string {
  if (err.status === 0) return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง';
  if (err.status === 429) return err.error?.message || 'ทำรายการบ่อยเกินไป กรุณาลองใหม่ภายหลัง';
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

/** ข้อความของ error รหัส 6 หลัก (ร่วมทุกงาน) */
export function codeErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'INVALID_CODE': return 'รหัสยืนยันไม่ถูกต้อง';
    case 'CODE_EXPIRED': return 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่';
    case 'CODE_LOCKED': return 'กรอกรหัสผิดเกิน 5 ครั้ง กรุณาขอรหัสใหม่';
    default: return fallback;
  }
}
