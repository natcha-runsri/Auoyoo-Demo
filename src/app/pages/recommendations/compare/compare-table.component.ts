import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductImageDirective } from '../../../components/product-image/product-image.directive';
import { CompareRow, CompareTable } from '../../../models/compare';

/**
 * (C) ตารางสเปก — แถวมาจาก backend (สเปกแยกเป็นหัวข้อตามประเภทสินค้าแล้ว)
 *  - ค่าที่ดีที่สุดของแถวตัวเลขที่เทียบได้ = พื้นเขียวอ่อน, คอลัมน์ที่ AI แนะนำ = พื้นเหลืองอ่อน
 *  - "แสดงเฉพาะที่ต่างกัน" ซ่อนแถวที่ทุกชิ้นค่าเท่ากัน
 *  - รายละเอียดเต็มจากร้านอยู่แถวสุดท้าย ยุบไว้ก่อน
 *  - หัวตาราง (รูป + ชื่อ) ติดด้านบน; มือถือเลื่อนแนวนอนในกรอบโดยคอลัมน์แรกติดซ้าย
 */
@Component({
  selector: 'app-compare-table',
  standalone: true,
  imports: [CommonModule, ProductImageDirective],
  templateUrl: './compare-table.component.html',
  styleUrl: './compare-table.component.css'
})
export class CompareTableComponent {
  @Input({ required: true }) table!: CompareTable;
  @Input() recommendedId: number | null = null;

  onlyDiff = false;
  detailsOpen = false;

  get rows(): CompareRow[] {
    return this.onlyDiff ? this.table.rows.filter(r => this.differs(r)) : this.table.rows;
  }

  get hiddenCount(): number {
    return this.table.rows.length - this.rows.length;
  }

  /** ค่าไม่เท่ากันทุกชิ้น ("ไม่มีข้อมูล" นับเป็นค่าหนึ่ง) */
  differs(row: CompareRow): boolean {
    return new Set(row.values.map(v => (v ?? '').trim().toLowerCase())).size > 1;
  }

  isBest(row: CompareRow, index: number): boolean {
    return row.best.includes(index);
  }

  isRecommended(index: number): boolean {
    return this.recommendedId !== null && this.table.products[index]?.product.id === this.recommendedId;
  }

  trackByKey(_: number, row: CompareRow): string {
    return row.key;
  }
}
