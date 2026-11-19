import { Component, ElementRef, HostListener, Injector, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, finalize } from 'rxjs';
import {
  AnalysisRange, HistoryDay, HistoryFilter, HistoryItem, HistoryService, HistorySummary
} from '../../services/history/history.service';
import { HistoryCalendarComponent } from './history-calendar.component';
import { HistoryAnalysisComponent } from './history-analysis.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { addDays, formatThaiFullDate, formatThaiRange, isValidIsoDate, monthOf, todayInBangkok } from './history-dates';

export interface FilterOption {
  value: HistoryFilter;
  label: string;
  icon: string;
}

export const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'ทั้งหมด', icon: 'grid_view' },
  { value: 'search', label: 'การค้นหา', icon: 'manage_search' },
  { value: 'view', label: 'การเข้าชม', icon: 'visibility' }
];

/**
 * หน้า "ประวัติและวิเคราะห์การใช้งาน" (/history, ต้องล็อกอิน, noindex)
 *  - ?date=yyyy-MM-dd  วันที่ของรายการฝั่งซ้าย และวันสุดท้ายของช่วงวิเคราะห์ (ไม่มี = วันนี้ตามเวลาไทย)
 *  - ?range=7|30      ช่วงวิเคราะห์ย้อนหลังนับถึงวันที่เลือก (ไม่มี = 7)
 * ตัวกรองรายการ (ทั้งหมด/ค้นหา/เข้าชม) กรองในหน้าเลย ไม่ต้องโหลดใหม่
 */
@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink, HistoryCalendarComponent, HistoryAnalysisComponent, ConfirmDialogComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit, OnDestroy {
  private readonly history = inject(HistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly filterOptions = FILTER_OPTIONS;

  today = todayInBangkok();
  date = this.today;
  range: AnalysisRange = 7;
  filter: HistoryFilter = 'all';

  day: HistoryDay | null = null;
  loadingDay = false;
  dayError = '';
  summary: HistorySummary | null = null;
  loadingSummary = false;
  summaryError = '';

  // ปฏิทิน
  calendarOpen = false;
  private readonly activeDaysByMonth = new Map<string, Set<string>>();
  activeDays: ReadonlySet<string> = new Set();

  // ตัวกรอง
  filterOpen = false;

  // ลบ
  deletingId: number | null = null;
  confirmDeleteAll = false;
  deletingAll = false;
  deleteError = '';

  private readonly sub = new Subscription();
  private daySub?: Subscription;
  private summarySub?: Subscription;

  @ViewChild('calendarButton') private calendarButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('filterButton') private filterButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('deleteAllButton') private deleteAllButton?: ElementRef<HTMLButtonElement>;
  @ViewChild(HistoryCalendarComponent) private calendar?: HistoryCalendarComponent;
  @ViewChildren('filterItem') private filterItems?: QueryList<ElementRef<HTMLButtonElement>>;

  ngOnInit(): void {
    this.sub.add(this.route.queryParamMap.subscribe(params => {
      this.today = todayInBangkok();
      const rawDate = params.get('date');
      const date = isValidIsoDate(rawDate) && rawDate <= this.today ? rawDate : this.today;
      const range: AnalysisRange = params.get('range') === '30' ? 30 : 7;
      const dateChanged = date !== this.date || !this.day;
      const rangeChanged = range !== this.range || !this.summary;
      this.date = date;
      this.range = range;
      if (dateChanged) this.loadDay();
      if (dateChanged || rangeChanged) this.loadSummary();
      // URL วันที่ผิดรูป/วันอนาคต -> แก้ URL ให้ตรงกับที่แสดงจริง
      if (rawDate !== null && rawDate !== date) this.navigate({ date }, true);
    }));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.daySub?.unsubscribe();
    this.summarySub?.unsubscribe();
  }

  // ===================== วันที่ =====================

  get dateLabel(): string {
    return formatThaiFullDate(this.date);
  }

  get isToday(): boolean {
    return this.date >= this.today;
  }

  previousDay(): void {
    this.goTo(addDays(this.date, -1));
  }

  nextDay(): void {
    if (!this.isToday) this.goTo(addDays(this.date, 1));
  }

  goToday(): void {
    this.goTo(todayInBangkok());
  }

  goTo(date: string): void {
    this.calendarOpen = false;
    if (date !== this.date) this.navigate({ date });
  }

  toggleCalendar(): void {
    if (this.calendarOpen) {
      this.closeCalendar();
      return;
    }
    this.filterOpen = false;
    this.calendarOpen = true;
    this.loadActiveDays(monthOf(this.date));
    afterNextRender(() => this.calendar?.focusCell(), { injector: this.injector });
  }

  closeCalendar(returnFocus = true): void {
    this.calendarOpen = false;
    if (returnFocus) this.calendarButton?.nativeElement.focus();
  }

  onCalendarPick(date: string): void {
    this.goTo(date);
    this.calendarButton?.nativeElement.focus();
  }

  loadActiveDays(month: string): void {
    const cached = this.activeDaysByMonth.get(month);
    if (cached) {
      this.activeDays = cached;
      return;
    }
    this.history.getActiveDays(month).subscribe({
      next: days => {
        const set = new Set(days);
        this.activeDaysByMonth.set(month, set);
        this.activeDays = set;
      },
      error: () => undefined
    });
  }

  // ===================== ช่วงวิเคราะห์ =====================

  /** ช่วงวันที่ที่ใช้วิเคราะห์ (คำนวณจากวันที่/ช่วงที่เลือก แสดงถูกตั้งแต่ก่อนข้อมูลมาถึง) */
  get rangeLabel(): string {
    return formatThaiRange(addDays(this.date, -(this.range - 1)), this.date);
  }

  setRange(range: AnalysisRange): void {
    if (range !== this.range) this.navigate({ range });
  }

  // ===================== รายการ + ตัวกรอง =====================

  get filterLabel(): string {
    return FILTER_OPTIONS.find(o => o.value === this.filter)!.label;
  }

  get filterIcon(): string {
    return FILTER_OPTIONS.find(o => o.value === this.filter)!.icon;
  }

  get visibleItems(): HistoryItem[] {
    const items = this.day?.items ?? [];
    if (this.filter === 'search') return items.filter(i => i.type === 'SEARCH');
    if (this.filter === 'view') return items.filter(i => i.type === 'VIEW');
    return items;
  }

  get emptyMessage(): string {
    if (this.filter === 'search' && this.day?.items.length) return 'ไม่มีประวัติการค้นหาในวันนี้';
    if (this.filter === 'view' && this.day?.items.length) return 'ไม่มีประวัติการเข้าชมในวันนี้';
    return 'ไม่มีประวัติในวันนี้';
  }

  toggleFilter(): void {
    this.filterOpen ? this.closeFilter() : this.openFilter(FILTER_OPTIONS.findIndex(o => o.value === this.filter));
  }

  openFilter(focusIndex: number): void {
    this.calendarOpen = false;
    this.filterOpen = true;
    afterNextRender(() => this.focusFilterItem(focusIndex), { injector: this.injector });
  }

  closeFilter(returnFocus = true): void {
    this.filterOpen = false;
    if (returnFocus) this.filterButton?.nativeElement.focus();
  }

  chooseFilter(value: HistoryFilter): void {
    this.filter = value;
    this.closeFilter();
  }

  onFilterButtonKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.openFilter(event.key === 'ArrowDown' ? 0 : FILTER_OPTIONS.length - 1);
    }
  }

  onFilterMenuKeydown(event: KeyboardEvent, index: number): void {
    const last = FILTER_OPTIONS.length - 1;
    const target = event.key === 'ArrowDown' ? (index + 1) % (last + 1)
      : event.key === 'ArrowUp' ? (index + last) % (last + 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (target !== null) {
      event.preventDefault();
      this.focusFilterItem(target);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      this.closeFilter(event.key === 'Escape');
    }
  }

  /**
   * ลิงก์ของแต่ละรายการ: แชท AI ที่เก็บบทสนทนาไว้ = เปิดอ่านแชทเดิม (อ่านอย่างเดียว),
   * ค้นหาอื่น ๆ = ค้นคำนั้นอีกครั้งที่เดิม, เข้าชม = หน้าสินค้า (สินค้าถูกลบไปแล้ว = null), เปรียบเทียบ = เปิดชุดเดิมอีกครั้ง
   */
  itemLink(item: HistoryItem): { path: string[]; query: Record<string, string> | null } | null {
    if (item.type === 'VIEW') return item.productId ? { path: ['/products', String(item.productId)], query: null } : null;
    if (item.chatId) return { path: ['/history/chat', String(item.chatId)], query: null };
    if (item.source === 'COMPARE') {
      return item.compareIds?.length ? { path: ['/recommendations'], query: { ids: item.compareIds.join(',') } } : null;
    }
    return { path: [item.source === 'CATEGORY' ? '/category' : '/recommendations'], query: { q: item.title } };
  }

  itemAction(item: HistoryItem): string {
    if (item.chatId) return 'เปิดอ่านแชท AI: ';
    return item.type === 'VIEW' ? 'ไปหน้าสินค้า: ' : item.source === 'COMPARE' ? 'เปิดการเปรียบเทียบอีกครั้ง: ' : 'ค้นหาอีกครั้ง: ';
  }

  itemText(item: HistoryItem): string {
    if (item.type === 'VIEW') return `เข้าชม ${item.title}`;
    // แชทเดียวกันรวมเป็นรายการเดียว: คำถามแรก + จำนวนคำถามที่เหลือ
    const more = (item.questionCount ?? 1) - 1;
    return more > 0 ? `${item.title} (+${more} คำถาม)` : item.title;
  }

  trackById(_: number, item: HistoryItem): number {
    return item.id;
  }

  // ===================== ลบ =====================

  deleteItem(item: HistoryItem): void {
    if (this.deletingId !== null) return;
    this.deletingId = item.id;
    this.deleteError = '';
    const index = this.visibleItems.findIndex(i => i.id === item.id);
    const removed = () => {
      if (this.day) this.day = { ...this.day, items: this.day.items.filter(i => i.id !== item.id) };
      this.afterDelete();
      this.focusAfterRemoval(index);
    };
    this.history.delete(item.id).pipe(finalize(() => (this.deletingId = null))).subscribe({
      next: removed,
      error: (err: HttpErrorResponse) => {
        // 404 = ถูกลบไปแล้ว (เช่นจากอีกแท็บ) -> เอาออกจากรายการเฉย ๆ
        if (err.status === 404) {
          removed();
          return;
        }
        this.deleteError = 'ลบรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      }
    });
  }

  openDeleteAll(): void {
    this.calendarOpen = false;
    this.filterOpen = false;
    this.deleteError = '';
    this.confirmDeleteAll = true;
  }

  cancelDeleteAll(): void {
    if (this.deletingAll) return;
    this.confirmDeleteAll = false;
    this.deleteAllButton?.nativeElement.focus();
  }

  deleteAll(): void {
    if (this.deletingAll) return;
    this.deletingAll = true;
    this.history.deleteAll().pipe(finalize(() => (this.deletingAll = false))).subscribe({
      next: () => {
        this.confirmDeleteAll = false;
        if (this.day) this.day = { ...this.day, items: [] };
        this.afterDelete();
        this.deleteAllButton?.nativeElement.focus();
      },
      error: () => (this.deleteError = 'ลบประวัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    });
  }

  // ===================== ทั่วไป =====================

  /** คลิกนอกปฏิทิน/เมนูตัวกรอง -> ปิด */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.calendarOpen && !this.host.nativeElement.querySelector('.date-picker')?.contains(target)) {
      this.closeCalendar(false);
    }
    if (this.filterOpen && !this.host.nativeElement.querySelector('.filter')?.contains(target)) {
      this.closeFilter(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.calendarOpen) this.closeCalendar();
    else if (this.filterOpen) this.closeFilter();
  }

  retry(): void {
    this.loadDay();
    this.loadSummary();
  }

  private afterDelete(): void {
    this.activeDaysByMonth.clear();
    this.loadSummary();
  }

  private loadDay(): void {
    this.daySub?.unsubscribe();
    this.loadingDay = true;
    this.dayError = '';
    this.deleteError = '';
    this.daySub = this.history.getDay(this.date).pipe(finalize(() => (this.loadingDay = false))).subscribe({
      next: day => (this.day = day),
      error: () => {
        this.day = null;
        this.dayError = 'โหลดประวัติไม่สำเร็จ';
      }
    });
  }

  private loadSummary(): void {
    this.summarySub?.unsubscribe();
    this.loadingSummary = true;
    this.summaryError = '';
    this.summarySub = this.history.getSummary(this.date, this.range).pipe(finalize(() => (this.loadingSummary = false))).subscribe({
      next: summary => (this.summary = summary),
      error: () => {
        this.summary = null;
        this.summaryError = 'โหลดข้อมูลวิเคราะห์ไม่สำเร็จ';
      }
    });
  }

  private navigate(params: { date?: string; range?: AnalysisRange }, replaceUrl = false): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl });
  }

  /** ลบแล้ว focus ไม่หลุด: ไปปุ่มลบของรายการที่มาแทนที่ (หรือรายการสุดท้าย) ไม่เหลือแล้วไปปุ่มตัวกรอง */
  private focusAfterRemoval(index: number): void {
    afterNextRender(() => {
      const buttons = this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.item-delete');
      const target = buttons[Math.min(index, buttons.length - 1)];
      (target ?? this.filterButton?.nativeElement)?.focus();
    }, { injector: this.injector });
  }

  private focusFilterItem(index: number): void {
    this.filterItems?.get(index)?.nativeElement.focus();
  }
}
