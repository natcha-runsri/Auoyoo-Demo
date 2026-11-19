import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductImageDirective } from '../../../components/product-image/product-image.directive';
import { CompareAnalysis, CompareTable, CompareTableProduct } from '../../../models/compare';

/**
 * (A) การ์ดสินค้าที่เปรียบเทียบ 2-4 คอลัมน์ (มือถือเลื่อนแนวนอน)
 * ป้าย: "AI แนะนำ" (ทอง + กรอบกรมท่า), "คุ้มค่าที่สุด"/"สเปกสูงสุด" (จาก AI), "ราคาถูกสุด" (จากราคาจริง ไม่ใช่ AI)
 */
@Component({
  selector: 'app-compare-cards',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductImageDirective],
  templateUrl: './compare-cards.component.html',
  styleUrl: './compare-cards.component.css'
})
export class CompareCardsComponent {
  @Input({ required: true }) table!: CompareTable;
  @Input() analysis: CompareAnalysis | null = null;
  @Output() remove = new EventEmitter<number>();

  priceOf(index: number): string | null {
    return this.table.rows.find(r => r.key === 'price')?.values[index] ?? null;
  }

  isRecommended(p: CompareTableProduct): boolean {
    return this.analysis?.recommendation?.id === p.product.id;
  }

  tags(p: CompareTableProduct): string[] {
    const id = p.product.id;
    const out: string[] = [];
    if (this.analysis?.bestValueId === id) out.push('คุ้มค่าที่สุด');
    if (this.analysis?.topSpecId === id) out.push('สเปกสูงสุด');
    if (this.table.cheapestIds.includes(id)) out.push('ราคาถูกสุด');
    return out;
  }

  trackById(_: number, p: CompareTableProduct): number {
    return p.product.id;
  }
}
