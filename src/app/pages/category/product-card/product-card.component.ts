import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProductImageDirective } from '../../../components/product-image/product-image.directive';
import { Product } from '../../../models/product';
import { CompareService } from '../../../services/compare/compare.service';
import { FavoriteService } from '../../../services/favorite/favorite.service';
import { AuthModalService } from '../../../services/auth-modal/auth-modal.service';
import { categoryLabel } from '../../../config/category-labels';

/**
 * การ์ดสินค้า (ใช้ร่วมกันทุกหน้า: หมวดหมู่, รายการโปรด, ผลแนะนำในแชท AI)
 * ปุ่มนิ้วโป้ง = รายการโปรด (ยังไม่ล็อกอิน -> popup ล็อกอิน), ปุ่มเปรียบเทียบ = แถบเปรียบเทียบ (สูงสุด CompareService.max ชิ้น)
 * วันที่ราคาแสดงที่หน้ารายละเอียดสินค้าแทน
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductImageDirective],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css']
})
export class ProductCardComponent implements OnInit {
  @Input({ required: true }) product!: Product;

  isFavorite$!: Observable<boolean>;
  isInCompare$!: Observable<boolean>;
  /** ปิดปุ่มเปรียบเทียบเมื่อ list เต็มและสินค้านี้ยังไม่อยู่ใน list */
  compareDisabled$!: Observable<boolean>;

  constructor(
    private compareService: CompareService,
    private favoriteService: FavoriteService,
    private authModal: AuthModalService
  ) {}

  ngOnInit(): void {
    this.isFavorite$ = this.favoriteService.isFavorite$(this.product.id);
    this.isInCompare$ = this.compareService.isInCompare$(this.product.id);
    this.compareDisabled$ = combineLatest([
      this.compareService.isFull$(),
      this.isInCompare$
    ]).pipe(map(([full, inList]) => full && !inList));
  }

  get badge(): string {
    return categoryLabel(this.product.category);
  }

  get compareMax(): number {
    return this.compareService.max;
  }

  /** "฿31,990" — ไม่มีราคา (ร้านขึ้น N/A) แสดง "ไม่มีข้อมูลราคา" */
  get priceText(): string {
    const value = this.product.priceMin ?? this.product.priceMax;
    return value == null ? 'ไม่มีข้อมูลราคา' : `฿${value.toLocaleString('en-US')}`;
  }

  onToggleFavorite(): void {
    // ยังไม่ล็อกอิน -> เด้ง login modal แทนการเก็บลง localStorage
    if (this.favoriteService.requiresLogin()) {
      this.authModal.open('login', { reason: 'เข้าสู่ระบบเพื่อบันทึกรายการโปรด' });
      return;
    }
    this.favoriteService.toggle(this.product).subscribe({ error: () => {} });
  }

  onToggleCompare(): void {
    this.compareService.toggle(this.product);
  }
}
