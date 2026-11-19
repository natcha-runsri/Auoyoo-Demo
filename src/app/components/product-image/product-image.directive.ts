import { Directive, HostListener, Input, OnChanges, inject } from '@angular/core';
import { GENERIC_MOCKUP, USE_REMOTE_PRODUCT_IMAGES, productMockupUrl } from '../../config/product-images';

/** ข้อมูลที่ต้องใช้เลือกรูป — ส่ง Product ทั้งตัวมาก็ได้ */
export interface ProductImageSource {
  image?: string | null;
  category?: string | null;
}

/**
 * ใช้กับทุก <img> ที่แสดงรูปสินค้า: <img [appProductImage]="product" [alt]="product.productName">
 *  - เปิดรูปจากร้านค้า (USE_REMOTE_PRODUCT_IMAGES) และมีลิงก์ -> ใช้ลิงก์ร้าน; ปิด/ไม่มีลิงก์ -> mockup ตามหมวด
 *  - รูปร้านโหลดไม่ได้ (ลิงก์เสีย/ร้านบล็อก) -> เปลี่ยนเป็น mockup ตามหมวดแทนไอคอนรูปแตก
 *  - loading="lazy" (โหลดเมื่อใกล้เลื่อนถึง) และ referrerpolicy="no-referrer" (ไม่บอกร้านว่าเปิดจากหน้าไหนของเรา)
 * ห้ามใส่ [src] ที่ <img> เองอีก — directive นี้คุม src ทั้งหมด
 */
@Directive({
  selector: 'img[appProductImage]',
  standalone: true,
  host: {
    '[attr.src]': 'src',
    'loading': 'lazy',
    'decoding': 'async',
    'referrerpolicy': 'no-referrer'
  }
})
export class ProductImageDirective implements OnChanges {
  @Input({ required: true }) appProductImage: ProductImageSource | null | undefined;

  private readonly useRemote = inject(USE_REMOTE_PRODUCT_IMAGES);
  src = GENERIC_MOCKUP;
  private fallbackStep = 0;

  ngOnChanges(): void {
    this.fallbackStep = 0;
    const remote = this.appProductImage?.image?.trim();
    this.src = this.useRemote && remote ? remote : productMockupUrl(this.appProductImage?.category);
  }

  @HostListener('error')
  onError(): void {
    // ขั้น 1: รูปร้านเสีย -> mockup ของหมวด; ขั้น 2: (กันพลาด) mockup ของหมวดก็เสีย -> mockup กลาง; จากนั้นหยุด ไม่วนซ้ำ
    const categoryMockup = productMockupUrl(this.appProductImage?.category);
    if (this.fallbackStep === 0 && this.src !== categoryMockup) {
      this.fallbackStep = 1;
      this.src = categoryMockup;
    } else if (this.fallbackStep < 2 && this.src !== GENERIC_MOCKUP) {
      this.fallbackStep = 2;
      this.src = GENERIC_MOCKUP;
    }
  }
}
