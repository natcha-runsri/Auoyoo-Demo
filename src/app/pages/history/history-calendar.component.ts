import { Component, ElementRef, EventEmitter, Injector, Input, OnChanges, Output, SimpleChanges, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarCell, WEEKDAY_HEADERS, addDays, addMonths, calendarWeeks, formatMonthTitle, formatThaiFullDate, monthOf } from './history-dates';

/**
 * ปฏิทินเลือกวันของหน้า /history (popover ใต้ปุ่ม "วันนี้")
 *  - เริ่มวันจันทร์, วันนี้ตัวเลขสีแดง, วันที่มีประวัติมีจุดใต้ตัวเลข, วันอนาคตเลือกไม่ได้
 *  - คีย์บอร์ด (WAI-ARIA date grid): ลูกศรเลื่อนทีละวัน/สัปดาห์, Home/End ต้น/ท้ายสัปดาห์,
 *    PageUp/PageDown เปลี่ยนเดือน, Enter/Space เลือก, Esc ปิด (parent จัดการปิด/คืน focus)
 */
@Component({
  selector: 'app-history-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-calendar.component.html',
  styleUrl: './history-calendar.component.css'
})
export class HistoryCalendarComponent implements OnChanges {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** วันที่เลือกอยู่ (yyyy-MM-dd) */
  @Input({ required: true }) selected!: string;
  /** วันนี้ (เวลาไทย) — วันหลังจากนี้เลือกไม่ได้ */
  @Input({ required: true }) today!: string;
  /** วันที่มีประวัติ (เฉพาะเดือนที่แสดงอยู่ก็พอ) */
  @Input() activeDays: ReadonlySet<string> = new Set();

  @Output() dateSelected = new EventEmitter<string>();
  /** เปลี่ยนเดือนที่แสดง ("yyyy-MM") — parent โหลดจุดของเดือนนั้น */
  @Output() monthChange = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  readonly weekdays = WEEKDAY_HEADERS;
  month = '';
  weeks: CalendarCell[][] = [];
  /** วันที่ถือ focus (roving tabindex) */
  focusDate = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selected'] && this.selected) {
      this.focusDate = this.selected;
      this.showMonth(monthOf(this.selected), false);
    }
  }

  get title(): string {
    return formatMonthTitle(this.month);
  }

  get canGoNext(): boolean {
    return this.month < monthOf(this.today);
  }

  isFuture(date: string): boolean {
    return date > this.today;
  }

  label(date: string): string {
    const extras = [date === this.today ? 'วันนี้' : '', this.activeDays.has(date) ? 'มีประวัติ' : ''].filter(Boolean);
    return formatThaiFullDate(date) + (extras.length ? ` (${extras.join(', ')})` : '');
  }

  prevMonth(): void {
    this.moveMonth(-1);
  }

  nextMonth(): void {
    if (this.canGoNext) this.moveMonth(1);
  }

  pick(date: string | null): void {
    if (!date || this.isFuture(date)) return;
    this.dateSelected.emit(date);
  }

  onKeydown(event: KeyboardEvent): void {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (event.key in moves) {
      next = addDays(this.focusDate, moves[event.key]);
    } else if (event.key === 'Home' || event.key === 'End') {
      const weekday = (new Date(`${this.focusDate}T00:00:00Z`).getUTCDay() + 6) % 7;
      next = addDays(this.focusDate, event.key === 'Home' ? -weekday : 6 - weekday);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      next = sameDayInMonth(this.focusDate, event.key === 'PageUp' ? -1 : 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.pick(this.focusDate);
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    } else {
      return;
    }
    event.preventDefault();
    if (next > this.today) next = this.today;
    this.focusDate = next;
    if (monthOf(next) !== this.month) this.showMonth(monthOf(next), true);
    this.focusCell();
  }

  /** ให้ parent สั่ง focus วันที่เลือกตอนเปิดปฏิทิน */
  focusCell(): void {
    afterNextRender(() => {
      this.host.nativeElement.querySelector<HTMLElement>(`[data-date="${this.focusDate}"]`)?.focus();
    }, { injector: this.injector });
  }

  private moveMonth(delta: number): void {
    const month = addMonths(this.month, delta);
    // วันที่ถือ focus ย้ายไปเดือนใหม่ด้วย (ไม่เกินวันนี้)
    const target = sameDayInMonth(this.focusDate, delta);
    this.focusDate = target > this.today ? this.today : target;
    this.showMonth(month, true);
  }

  private showMonth(month: string, notify: boolean): void {
    const changed = month !== this.month;
    this.month = month;
    this.weeks = calendarWeeks(month);
    if (changed && notify) this.monthChange.emit(month);
  }
}

/** วันเดียวกันของเดือนถัดไป/ก่อนหน้า (31 ม.ค. + 1 เดือน = 28/29 ก.พ.) */
function sameDayInMonth(iso: string, delta: number): string {
  const month = addMonths(iso.slice(0, 7), delta);
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Number(iso.slice(8, 10)), last);
  return `${month}-${String(day).padStart(2, '0')}`;
}
