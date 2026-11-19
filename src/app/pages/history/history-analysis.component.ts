import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalysisRange, HistorySummary } from '../../services/history/history.service';
import { DonutChartComponent } from './donut-chart.component';
import {
  NOT_ENOUGH_DATA, categoryColors, categoryInsight, chartAriaLabel, hasEnoughCategoryData, hasEnoughPriceData,
  priceColors, priceInsight
} from './history-insights';

/**
 * ฝั่งขวาของหน้า /history: ปุ่มสลับช่วง [7 วัน | 30 วัน] + การ์ด "หมวดหมู่ที่สนใจ" และ "ช่วงราคาที่สนใจ"
 * ข้อมูลไม่พอ (< 3 รายการ) -> วงแหวนสีเทา + "ยังมีข้อมูลไม่พอสำหรับวิเคราะห์"
 */
@Component({
  selector: 'app-history-analysis',
  standalone: true,
  imports: [CommonModule, DonutChartComponent],
  templateUrl: './history-analysis.component.html',
  styleUrl: './history-analysis.component.css'
})
export class HistoryAnalysisComponent {
  @Input() summary: HistorySummary | null = null;
  @Input() range: AnalysisRange = 7;
  /** ช่วงวันที่ที่ใช้วิเคราะห์ เช่น "5 – 11 ส.ค. 2569" */
  @Input() rangeLabel = '';
  @Input() loading = false;
  @Input() error = '';
  @Output() rangeChange = new EventEmitter<AnalysisRange>();
  @Output() retry = new EventEmitter<void>();

  readonly ranges: AnalysisRange[] = [7, 30];
  readonly notEnoughData = NOT_ENOUGH_DATA;

  get categoryEnough(): boolean { return hasEnoughCategoryData(this.summary); }
  get priceEnough(): boolean { return hasEnoughPriceData(this.summary); }
  get categoryColors(): string[] { return categoryColors(this.summary?.categories ?? []); }
  get priceColors(): string[] { return priceColors(this.summary?.priceRanges ?? []); }
  get categoryText(): string { return categoryInsight(this.summary); }
  get priceText(): string { return priceInsight(this.summary); }
  get categoryAria(): string { return chartAriaLabel('หมวดหมู่ที่สนใจ', this.summary?.categories ?? [], this.categoryEnough); }
  get priceAria(): string { return chartAriaLabel('ช่วงราคาที่สนใจ', this.summary?.priceRanges ?? [], this.priceEnough); }

  setRange(range: AnalysisRange): void {
    if (range !== this.range) this.rangeChange.emit(range);
  }
}
