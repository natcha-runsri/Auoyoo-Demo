import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThaiDatePipe } from '../../../pipes/thai-date.pipe';
import { CompareAnalysis, CompareTable } from '../../../models/compare';
import { AiAvatarComponent } from './ai-avatar.component';

export type AnalysisState = 'loading' | 'ok' | 'error' | 'off';

/** (B) สรุปโดย AI — ระหว่างรอ: skeleton, ล้ม: "วิเคราะห์ไม่สำเร็จ" + ลองใหม่, สำเร็จ: ภาพรวม / ทีละชิ้น / คำแนะนำ / กรณีเลือก */
@Component({
  selector: 'app-compare-summary',
  standalone: true,
  imports: [CommonModule, ThaiDatePipe, AiAvatarComponent],
  templateUrl: './compare-summary.component.html',
  styleUrl: './compare-summary.component.css'
})
export class CompareSummaryComponent {
  @Input() state: AnalysisState = 'loading';
  @Input() analysis: CompareAnalysis | null = null;
  @Input({ required: true }) table!: CompareTable;
  /** guest หมดโควตา = กดแล้วเปิด popup ล็อกอินแทน */
  @Input() canReanalyze = true;
  @Output() reanalyze = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();

  /** ชื่อสินค้าตามรหัส (ชื่อเต็มจาก DB — ไม่ใช้ชื่อที่ AI เขียน) */
  nameOf(id: number | null | undefined): string {
    return this.table.products.find(p => p.product.id === id)?.product.productName ?? '';
  }

  /** วันที่ของข้อมูล: วันที่ราคาล่าสุด ไม่มีใช้วันที่วิเคราะห์ */
  get asOf(): string | null {
    return this.analysis?.dataAsOf ?? this.analysis?.analyzedAt?.slice(0, 10) ?? null;
  }
}
