import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Slice } from '../../services/history/history.service';

/** วงกลมรอบวงแหวน (r = 38 ใน viewBox 100x100) */
const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Segment {
  color: string;
  dash: string;
  offset: number;
}

/**
 * กราฟวงแหวน SVG เขียนเอง (ไม่ใช้ไลบรารีกราฟ) — แต่ละชิ้นคือ <circle> ที่ใช้ stroke-dasharray วาดเฉพาะส่วนของตัวเอง
 * เริ่มที่ 12 นาฬิกาเวียนตามเข็ม; ไม่มีข้อมูล (slices ว่าง) = วงสีเทาทั้งวง
 * screen reader อ่าน ariaLabel (สรุปเป็นข้อความ) แทนตัวกราฟ
 */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg viewBox="0 0 100 100" role="img" [attr.aria-label]="ariaLabel" focusable="false">
      <circle class="track" cx="50" cy="50" [attr.r]="radius"></circle>
      <circle *ngFor="let s of segments" cx="50" cy="50" [attr.r]="radius" class="seg"
        [attr.stroke]="s.color" [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset"></circle>
    </svg>
  `,
  styles: [`
    :host { display: block; width: 132px; height: 132px; }
    svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    circle { fill: none; stroke-width: 15; }
    .track { stroke: #e3e6ec; }
  `]
})
export class DonutChartComponent {
  @Input() slices: Slice[] = [];
  @Input() colors: string[] = [];
  /** ข้อความสำหรับ screen reader เช่น "หมวดหมู่ที่สนใจ: โน้ตบุ๊ค 50%, ..." */
  @Input() ariaLabel = '';

  readonly radius = RADIUS;

  get segments(): Segment[] {
    const total = this.slices.reduce((sum, s) => sum + s.count, 0);
    if (!total) return [];
    let start = 0;
    return this.slices.map((s, i) => {
      const length = (s.count / total) * CIRCUMFERENCE;
      const segment = { color: this.colors[i % this.colors.length], dash: `${length} ${CIRCUMFERENCE - length}`, offset: -start };
      start += length;
      return segment;
    });
  }
}
