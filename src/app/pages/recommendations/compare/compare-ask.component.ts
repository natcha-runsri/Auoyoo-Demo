import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AI_MAX_MESSAGE_LENGTH } from '../../../services/recommend/recommend.service';
import { AiAvatarComponent } from './ai-avatar.component';

export interface AskMessage {
  role: 'user' | 'bot';
  text: string;
  /** ตอบไม่สำเร็จ (แสดงสีแจ้งเตือน) */
  error?: boolean;
}

const MAX_INPUT_LINES = 5;

/**
 * (D) ถาม AI เพิ่มเกี่ยวกับสินค้าชุดนี้ — ช่องพิมพ์แบบเดียวกับแชท AI (Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่)
 * ปุ่มคำถามแนะนำ 3 ปุ่ม คำตอบเป็นฟองข้อความใต้ช่องพิมพ์; โควตา guest เดียวกับแชท
 */
@Component({
  selector: 'app-compare-ask',
  standalone: true,
  imports: [CommonModule, AiAvatarComponent],
  templateUrl: './compare-ask.component.html',
  styleUrl: './compare-ask.component.css'
})
export class CompareAskComponent {
  @Input() messages: AskMessage[] = [];
  @Input() loading = false;
  @Input() isLoggedIn = false;
  @Input() guestRemaining = 0;
  @Input() guestQuotaMax = 5;
  @Output() ask = new EventEmitter<string>();
  @Output() login = new EventEmitter<void>();

  @ViewChild('box') private box?: ElementRef<HTMLTextAreaElement>;

  readonly maxLength = AI_MAX_MESSAGE_LENGTH;
  readonly suggestions = ['ตัวไหนคุ้มที่สุด', 'ตัวไหนเหมาะกับเล่นเกม', 'ต่างกันคุ้มกับราคาไหม'];
  input = '';

  get quotaOut(): boolean {
    return !this.isLoggedIn && this.guestRemaining <= 0;
  }

  get canSend(): boolean {
    return !this.loading && !!this.input.trim() && !this.quotaOut;
  }

  onInput(event: Event): void {
    this.input = (event.target as HTMLTextAreaElement).value;
    this.autoGrow();
  }

  onKeydown(event: KeyboardEvent): void {
    // ระหว่างพิมพ์ภาษาไทยด้วย IME ยังไม่ส่ง
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    if (!this.canSend) return;
    this.ask.emit(this.input.trim());
    this.input = '';
    const el = this.box?.nativeElement;
    if (el) {
      el.value = '';
      el.style.height = '';
    }
  }

  suggest(text: string): void {
    if (this.loading) return;
    if (this.quotaOut) {
      this.login.emit();
      return;
    }
    this.ask.emit(text);
  }

  private autoGrow(): void {
    const el = this.box?.nativeElement;
    if (!el) return;
    const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 22;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_INPUT_LINES + 4)}px`;
  }
}
