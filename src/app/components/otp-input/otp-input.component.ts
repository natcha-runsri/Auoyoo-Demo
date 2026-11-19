import { Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * ช่องกรอกรหัสตัวเลขแบบแยกช่อง (ค่าเริ่มต้น 6 ช่อง ช่องละ 1 หลัก)
 *  - รับเฉพาะตัวเลข พิมพ์แล้วเลื่อนไปช่องถัดไป, Backspace ในช่องว่างถอยกลับช่องก่อนหน้า, ลูกศรซ้าย/ขวา/Home/End เลื่อนได้
 *  - วางรหัสทั้งชุด (paste) หรือมือถือเติมอัตโนมัติจาก SMS/อีเมล (autocomplete="one-time-code") ได้ในครั้งเดียว
 *  - ครบทุกช่อง -> emit completed(code)
 * ไม่ตั้ง maxlength=1 โดยตั้งใจ: การเติมอัตโนมัติของมือถือใส่รหัสทั้งชุดลงช่องที่ focus อยู่ ต้องรับมาแล้วกระจายเอง
 */
@Component({
  selector: 'app-otp-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.css'
})
export class OtpInputComponent {
  @Input() set length(value: number) {
    this.digits = Array(value).fill('');
  }
  get length(): number {
    return this.digits.length;
  }

  /** ทุกช่องเป็นสีแดง (เช่น รหัสผิด) — หายเองเมื่อผู้ใช้เริ่มพิมพ์ใหม่ (parent รับ changed แล้วปิดเอง) */
  @Input() invalid = false;
  @Input() disabled = false;
  /** id ของ label ที่อธิบายกลุ่มช่องนี้ (เช่น "รหัสยืนยัน") */
  @Input() labelledBy: string | null = null;
  /** id prefix ของแต่ละช่อง -> `${idPrefix}-0` ... ใช้ผูก <label for> กับช่องแรก */
  @Input() idPrefix = 'otp';

  @Output() completed = new EventEmitter<string>();
  @Output() changed = new EventEmitter<string>();

  digits: string[] = Array(6).fill('');

  @ViewChildren('box') private boxes?: QueryList<ElementRef<HTMLInputElement>>;

  /** ไม่สร้าง <input> ใหม่ตอนล้างค่า (คง focus/สถานะเดิมไว้) */
  trackIndex(index: number): number {
    return index;
  }

  get value(): string {
    return this.digits.join('');
  }

  get isComplete(): boolean {
    return this.digits.every(d => d !== '');
  }

  clear(): void {
    this.digits = this.digits.map(() => '');
    this.syncDom();
  }

  focus(index = 0): void {
    const target = this.boxes?.get(Math.max(0, Math.min(index, this.length - 1)))?.nativeElement;
    target?.focus();
    target?.select();
  }

  onFocus(event: FocusEvent): void {
    // เลือกตัวเลขเดิมไว้ พิมพ์ทับได้เลยไม่ต้องลบก่อน
    (event.target as HTMLInputElement).select();
  }

  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.replace(/\D/g, '');

    if (!typed) {
      this.digits[index] = '';
      input.value = '';
      this.emitChange();
      return;
    }
    if (typed.length === 1) {
      this.digits[index] = typed;
      input.value = typed;
      this.emitChange();
      this.focus(index + 1);
      return;
    }
    // มากกว่า 1 หลักในช่องเดียว = เติมอัตโนมัติ (one-time-code) -> กระจายลงช่องถัด ๆ ไป
    this.fillFrom(typed.length >= this.length ? 0 : index, typed);
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    switch (event.key) {
      case 'Backspace':
        if (!this.digits[index] && index > 0) {
          // ช่องนี้ว่างอยู่แล้ว -> ถอยไปลบช่องก่อนหน้า
          event.preventDefault();
          this.digits[index - 1] = '';
          this.syncDom();
          this.emitChange();
          this.focus(index - 1);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.focus(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.focus(index + 1);
        break;
      case 'Home':
        event.preventDefault();
        this.focus(0);
        break;
      case 'End':
        event.preventDefault();
        this.focus(this.length - 1);
        break;
    }
  }

  onPaste(index: number, event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (pasted) {
      // วางรหัสครบชุด -> เริ่มที่ช่องแรกเสมอ ไม่ว่าวางที่ช่องไหน
      this.fillFrom(pasted.length >= this.length ? 0 : index, pasted);
    }
  }

  private fillFrom(start: number, digits: string): void {
    const chars = digits.slice(0, this.length - start).split('');
    chars.forEach((d, i) => (this.digits[start + i] = d));
    this.syncDom();
    this.emitChange();
    const nextEmpty = this.digits.findIndex(d => !d);
    this.focus(nextEmpty === -1 ? this.length - 1 : nextEmpty);
  }

  private emitChange(): void {
    this.changed.emit(this.value);
    if (this.isComplete) {
      this.completed.emit(this.value);
    }
  }

  /** เขียนค่าลง <input> ตรง ๆ ด้วย — กันกรณีค่าเดิมเหมือนเดิมแต่ DOM เปลี่ยนไปแล้ว ([value] binding จะไม่อัปเดตซ้ำ) */
  private syncDom(): void {
    this.boxes?.forEach((ref, i) => (ref.nativeElement.value = this.digits[i]));
  }
}
