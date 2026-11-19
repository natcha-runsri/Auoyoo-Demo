import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FavoriteProduct } from '../../models/product';
import { ProductImageDirective } from '../../components/product-image/product-image.directive';
import { savedAgo } from './favorite-utils';

/**
 * การ์ดเฉพาะหน้ารายการโปรด (การ์ดสินค้าที่ใช้ร่วมกับหน้าหมวดหมู่/แชท AI ไม่เกี่ยว)
 * รูปในกรอบขาว, ชื่อ 2 บรรทัด, ป้ายสเปกเด่น, เวลาที่บันทึก, ราคา + ดูรายละเอียด, ปุ่มหัวใจทึบมุมขวาบน = ลบออก
 */
@Component({
  selector: 'app-favorite-card',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductImageDirective],
  templateUrl: './favorite-card.component.html',
  styleUrl: './favorite-card.component.css'
})
export class FavoriteCardComponent {
  @Input({ required: true }) product!: FavoriteProduct;
  /** เวลาปัจจุบัน (ส่งมาจากหน้า ให้การ์ดทุกใบคิดจากเวลาเดียวกัน) */
  @Input() now: Date = new Date();
  /** กำลังค่อย ๆ หายไปหลังกดลบ */
  @Input() leaving = false;
  @Output() remove = new EventEmitter<FavoriteProduct>();

  get savedText(): string {
    return savedAgo(this.product.savedAt, this.now);
  }

  get priceText(): string {
    const value = this.product.priceMin ?? this.product.priceMax;
    return value == null ? 'ไม่มีข้อมูลราคา' : `฿${value.toLocaleString('en-US')}`;
  }

  get highlights(): string[] {
    return (this.product.highlights ?? []).filter(h => !!h?.trim()).slice(0, 3);
  }
}
