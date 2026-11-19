import { AfterViewInit, Component, ElementRef, Input, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * ช่องรหัสผ่าน + ปุ่มรูปตาแสดง/ซ่อน ใช้กับ formControlName ได้ (ControlValueAccessor)
 * ใช้ใน popup หน้าโปรไฟล์ (ยืนยันตัวตน / เปลี่ยนรหัสผ่าน) — popup ลืมรหัสผ่านเดิมไม่แตะ
 * variant: "soft" = พื้นฟ้าอ่อนกรอบฟ้า (ช่องทั่วไป) / "outline" = พื้นขาวกรอบกรมท่า (ขั้นยืนยันตัวตน)
 */
@Component({
  selector: 'app-password-input',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordInputComponent), multi: true }],
  template: `
    <div class="pw" [class.pw-invalid]="invalid" [class.pw-outline]="variant === 'outline'">
      <input #field [id]="inputId" [type]="visible ? 'text' : 'password'" [placeholder]="placeholder"
        [attr.autocomplete]="autocomplete" [attr.aria-invalid]="invalid" [attr.aria-describedby]="describedBy"
        [disabled]="disabled" (input)="onInput($event)" (blur)="onTouched()" />
      <button type="button" class="pw-eye" (click)="visible = !visible" (mousedown)="$event.preventDefault()"
        [attr.aria-label]="visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'" [attr.aria-pressed]="visible" [attr.aria-controls]="inputId">
        <span class="material-symbols-outlined" aria-hidden="true">{{ visible ? 'visibility' : 'visibility_off' }}</span>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pw { display: flex; align-items: center; gap: 8px; height: 50px; padding: 0 10px 0 16px; box-sizing: border-box;
      border: 1px solid #b9cdea; border-radius: 6px; background: #f4f8fe; transition: border-color .15s, box-shadow .15s; }
    .pw.pw-outline { background: #fff; border-color: #5f6f8f; }
    .pw:focus-within { border-color: #5b8fd6; box-shadow: 0 0 0 3px rgba(91, 143, 214, .2); }
    .pw.pw-invalid { border-color: #c0392b; }
    input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: transparent;
      font-family: inherit; font-size: 16px; color: #1c1c1c; }
    input::placeholder { color: #8a96a8; }
    .pw-eye { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%;
      background: transparent; color: #3d4a5f; cursor: pointer; }
    @media (hover: hover) { .pw-eye:hover { background: rgba(31, 47, 77, .06); } }
    .pw-eye:focus-visible { outline: 2px solid #5b8fd6; }
    .pw-eye .material-symbols-outlined { font-size: 21px; }
    /* จอสัมผัส: พื้นที่กดรอบปุ่ม 44px */
    @media (max-width: 1023px) { .pw-eye { position: relative; } .pw-eye::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; } }
  `]
})
export class PasswordInputComponent implements ControlValueAccessor, AfterViewInit {
  @Input({ required: true }) inputId!: string;
  @Input() placeholder = '';
  @Input() autocomplete = 'current-password';
  @Input() invalid = false;
  @Input() describedBy: string | null = null;
  @Input() variant: 'soft' | 'outline' = 'soft';

  /** เขียนค่าลง DOM เอง (ไม่ผูก [value]) — ไม่งั้น form.reset() หลังพิมพ์จะไม่ล้างช่อง เพราะ binding ไม่เห็นว่าค่าเปลี่ยน */
  @ViewChild('field') private field?: ElementRef<HTMLInputElement>;

  value = '';
  visible = false;
  disabled = false;
  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  onInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.onChange(this.value);
  }

  ngAfterViewInit(): void { this.syncField(); }

  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.syncField();
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  /** ให้ popup focus ช่องนี้ได้ */
  focus(): void {
    this.field?.nativeElement.focus();
  }

  private syncField(): void {
    if (this.field) this.field.nativeElement.value = this.value;
  }
}
