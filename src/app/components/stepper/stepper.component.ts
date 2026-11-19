import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * แถบขั้นตอนของ popup หน้าโปรไฟล์: วงกลมเชื่อมด้วยเส้น ใต้วงมีป้าย
 *   ผ่านแล้ว   -> วงทึบกรมท่า เครื่องหมายถูกสีเหลืองครีม
 *   ปัจจุบัน   -> วงทึบกรมท่า ตัวเลขสีเหลืองครีม (aria-current="step")
 *   ยังไม่ถึง  -> วงขอบกรมท่า พื้นขาว ตัวเลขสีแดงเข้ม
 * current = index ของขั้นปัจจุบัน (เริ่ม 0); current >= จำนวนขั้น = ผ่านครบทุกขั้น
 */
@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ol class="stepper" [attr.aria-label]="label">
      <li *ngFor="let step of steps; let i = index" class="step"
        [class.done]="i < current" [class.current]="i === current" [class.todo]="i > current"
        [attr.aria-current]="i === current ? 'step' : null">
        <span class="circle" aria-hidden="true">
          <span *ngIf="i < current" class="material-symbols-outlined">check</span>
          <span *ngIf="i >= current">{{ i + 1 }}</span>
        </span>
        <span class="name">{{ step }}<span class="visually-hidden">{{ i < current ? ' (เสร็จแล้ว)' : '' }}</span></span>
      </li>
    </ol>
  `,
  styles: [`
    :host { display: block; }
    .stepper { display: flex; justify-content: center; margin: 0 auto; padding: 0; list-style: none; max-width: 420px; }
    .step { position: relative; flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
    /* เส้นเชื่อมไปยังขั้นถัดไป (อยู่หลังวงกลม) */
    .step:not(:last-child)::after {
      content: ''; position: absolute; top: 19px; left: calc(50% + 20px); right: calc(-50% + 20px);
      height: 2px; background: #5f789d;
    }
    .circle {
      width: 40px; height: 40px; border-radius: 50%; box-sizing: border-box;
      display: grid; place-items: center; font-size: 18px; font-weight: 600;
      border: 2px solid #1f2f4d; background: #fff; color: #8b1414;
    }
    .done .circle, .current .circle { background: #1f2f4d; color: #f5e6a8; }
    .circle .material-symbols-outlined { font-size: 22px; color: #f5e6a8; }
    .name { font-size: 14px; font-weight: 600; color: #1f2f4d; text-align: center; white-space: nowrap; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    @media (max-width: 479px) { .circle { width: 34px; height: 34px; font-size: 15px; }
      .step:not(:last-child)::after { top: 16px; left: calc(50% + 17px); right: calc(-50% + 17px); }
      .name { font-size: 12px; } }
  `]
})
export class StepperComponent {
  @Input() steps: string[] = [];
  @Input() current = 0;
  @Input() label = 'ขั้นตอน';
}
