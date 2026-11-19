import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, debounceTime } from 'rxjs';

/** null = ไม่ได้กรองด้านนั้น (อยู่ที่ขอบของช่วงราคาจริง) */
export interface PriceRange {
  min: number | null;
  max: number | null;
}

/** รอผู้ใช้หยุดลาก/หยุดพิมพ์ก่อนค่อยกรอง (ไม่ยิง API ทุกครั้งที่ขยับ) */
export const PRICE_DEBOUNCE_MS = 400;

/**
 * แถบงบประมาณ 2 หัว (input[type=range] 2 ตัวซ้อนกัน -> ใช้คีย์บอร์ดได้) + ช่องกรอกราคาต่ำสุด/สูงสุด
 *  - floor/ceiling = ราคาต่ำสุด/สูงสุดจริงของหมวด (จาก backend)
 *  - value = ค่าจาก URL (null = ไม่ได้กรอง)
 *  - ลากหรือพิมพ์ -> หัวจับ/ช่องขยับตามกันทันที แล้ว emit หลังหยุด 0.4 วิ; อยู่ที่ขอบ = null
 */
@Component({
  selector: 'app-price-range',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './price-range.component.html',
  styleUrls: ['./price-range.component.css']
})
export class PriceRangeComponent implements OnChanges, OnDestroy {
  @Input() floor = 0;
  @Input() ceiling = 0;
  @Input() value: PriceRange = { min: null, max: null };
  @Output() rangeChange = new EventEmitter<PriceRange>();

  minPrice = 0;
  maxPrice = 0;
  /** ข้อความในช่องกรอก (พิมพ์ค้างได้โดยยังไม่ถูกบีบค่า) */
  minText = '';
  maxText = '';

  private readonly pending = new Subject<void>();
  private readonly sub: Subscription;

  constructor() {
    this.sub = this.pending.pipe(debounceTime(PRICE_DEBOUNCE_MS)).subscribe(() => this.commit());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['floor'] || changes['ceiling'] || changes['value']) {
      this.minPrice = this.clamp(this.value?.min ?? this.floor, this.floor, this.ceiling);
      this.maxPrice = this.clamp(this.value?.max ?? this.ceiling, this.minPrice, this.ceiling);
      this.syncText();
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get disabled(): boolean {
    return this.ceiling <= this.floor;
  }

  /** ระยะก้าวของแถบเลื่อนตามความกว้างของช่วงราคา */
  get step(): number {
    const span = this.ceiling - this.floor;
    return span > 200_000 ? 1000 : span > 50_000 ? 500 : span > 5_000 ? 100 : 10;
  }

  get minPercent(): number {
    return this.percent(this.minPrice);
  }

  get maxPercent(): number {
    return this.percent(this.maxPrice);
  }

  label(value: number): string {
    return `฿${Math.round(value).toLocaleString('en-US')}`;
  }

  onMinSlide(event: Event): void {
    this.minPrice = Math.min(Number((event.target as HTMLInputElement).value), this.maxPrice);
    (event.target as HTMLInputElement).value = String(this.minPrice);
    this.minText = this.minPrice.toLocaleString('en-US');
    this.pending.next();
  }

  onMaxSlide(event: Event): void {
    this.maxPrice = Math.max(Number((event.target as HTMLInputElement).value), this.minPrice);
    (event.target as HTMLInputElement).value = String(this.maxPrice);
    this.maxText = this.maxPrice.toLocaleString('en-US');
    this.pending.next();
  }

  /** พิมพ์ -> หัวจับขยับตามทันที (ยังไม่บีบค่าระหว่างพิมพ์) แล้วค่อยบีบตอน commit */
  onMinTyped(event: Event): void {
    this.minText = (event.target as HTMLInputElement).value;
    const n = parseAmount(this.minText);
    if (n !== null) this.minPrice = this.clamp(n, this.floor, this.ceiling);
    this.pending.next();
  }

  onMaxTyped(event: Event): void {
    this.maxText = (event.target as HTMLInputElement).value;
    const n = parseAmount(this.maxText);
    if (n !== null) this.maxPrice = this.clamp(n, this.floor, this.ceiling);
    this.pending.next();
  }

  /** ออกจากช่อง/กด Enter -> กรองทันทีไม่ต้องรอ */
  commitNow(): void {
    this.commit();
  }

  private commit(): void {
    // กันต่ำสุดเกินสูงสุด: ช่องที่ผิดถูกบีบเข้าหาอีกช่อง
    this.minPrice = this.clamp(parseAmount(this.minText) ?? this.minPrice, this.floor, this.ceiling);
    this.maxPrice = this.clamp(parseAmount(this.maxText) ?? this.maxPrice, this.floor, this.ceiling);
    if (this.minPrice > this.maxPrice) [this.minPrice, this.maxPrice] = [this.maxPrice, this.minPrice];
    this.syncText();
    const next: PriceRange = {
      min: this.minPrice <= this.floor ? null : this.minPrice,
      max: this.maxPrice >= this.ceiling ? null : this.maxPrice
    };
    if (next.min !== (this.value?.min ?? null) || next.max !== (this.value?.max ?? null)) {
      this.rangeChange.emit(next);
    }
  }

  private syncText(): void {
    this.minText = Math.round(this.minPrice).toLocaleString('en-US');
    this.maxText = Math.round(this.maxPrice).toLocaleString('en-US');
  }

  private percent(v: number): number {
    return this.ceiling > this.floor ? ((v - this.floor) / (this.ceiling - this.floor)) * 100 : 0;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

/** "10,000" / "10000" -> 10000; ว่าง/ไม่ใช่ตัวเลข -> null */
export function parseAmount(text: string): number | null {
  const cleaned = (text ?? '').replace(/[,\s฿]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
