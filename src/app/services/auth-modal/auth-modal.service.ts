import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** login/register/forgot = ผู้ที่ยังไม่ล็อกอิน; email-change/password-change = popup หน้าโปรไฟล์ */
export type AuthView = 'login' | 'register' | 'forgot' | 'email-change' | 'password-change' | null;

export interface AuthModalOptions {
  /** ข้อความอธิบายเหตุผลที่ต้อง login เช่น "เข้าสู่ระบบเพื่อบันทึกรายการโปรด" (ใช้ตอน view = 'login') */
  reason?: string;
}

/** ข้อมูลที่ฝากไปให้ฟอร์ม login ตอนสลับ view (อ่านได้ครั้งเดียว) */
export interface LoginPrefill {
  /** เติมช่อง Username — มาจาก "Back to Login" ของฟอร์มสมัคร หรือหลังตั้งรหัสผ่านใหม่สำเร็จ */
  username?: string;
  /** ข้อความสีเขียวด้านบนฟอร์ม เช่น "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบ" */
  notice?: string;
}

/**
 * ศูนย์กลาง state ของ Login/Register/Forgot-password modal ทั้งหมด
 * มี modal แสดงอยู่ "อันเดียวเสมอ" — auth-modal-host เป็นตัวเดียวที่ mount overlay/กรอบ modal จริง
 * ตาม view$ ที่ service นี้ถืออยู่ ส่วน component อื่น (product-card, favorites, login, register ฯลฯ)
 * แค่เรียก open()/switchTo()/close() โดยไม่ต้องรู้จัก DOM ของ modal เลย
 */
@Injectable({ providedIn: 'root' })
export class AuthModalService {
  private readonly viewSubject = new BehaviorSubject<AuthView>(null);
  readonly view$: Observable<AuthView> = this.viewSubject.asObservable();

  private readonly reasonSubject = new BehaviorSubject<string | undefined>(undefined);
  readonly reason$: Observable<string | undefined> = this.reasonSubject.asObservable();

  private loginPrefill: LoginPrefill | null = null;

  get currentView(): AuthView {
    return this.viewSubject.value;
  }

  /** เปิด modal ใหม่ (ใช้ตอนปิดสนิทอยู่ก่อน เช่น กดปุ่ม "เข้าสู่ระบบ" ที่ navbar) */
  open(view: Exclude<AuthView, null>, options?: AuthModalOptions): void {
    this.reasonSubject.next(options?.reason);
    this.viewSubject.next(view);
  }

  /** สลับเนื้อหาใน modal เดิมที่เปิดอยู่แล้ว โดยไม่ปิด-เปิด overlay ใหม่ (เช่น Login -> Forgot Password) */
  switchTo(view: Exclude<AuthView, null>, prefill?: LoginPrefill): void {
    const username = prefill?.username?.trim() || undefined;
    this.loginPrefill = view === 'login' && (username || prefill?.notice) ? { username, notice: prefill?.notice } : null;
    this.viewSubject.next(view);
  }

  /** LoginComponent เรียกตอนสร้าง — คืนข้อมูลที่ฝากไว้ (ถ้ามี) แล้วล้างทิ้ง */
  consumeLoginPrefill(): LoginPrefill | null {
    const value = this.loginPrefill;
    this.loginPrefill = null;
    return value;
  }

  close(): void {
    this.loginPrefill = null;
    this.viewSubject.next(null);
    this.reasonSubject.next(undefined);
  }
}
