import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Category } from '../../../models/category';
import { BrandCount } from '../../../services/category/category.service';
import { categoryIcon } from '../../../config/category-labels';

export interface BrandToggleEvent {
  /** ชื่อแบรนด์ตัวพิมพ์เล็ก (ค่าใน URL ?brand=) */
  brand: string;
  checked: boolean;
}

/** แสดงแบรนด์ทีละเท่านี้ก่อนกด "ดูเพิ่มเติม" */
export const BRAND_PREVIEW = 8;
export const UNKNOWN_BRAND = 'unknown';

/**
 * sidebar หมวดหมู่ (แสดงผลอย่างเดียว — หมวด/แบรนด์ที่เลือกมาจาก URL ผ่านหน้า /category)
 *  - กลุ่มหลักเป็นแคปซูล กดเพื่อกาง/หุบ; "อุปกรณ์ทั้งหมด" กดแล้วแสดงสินค้าทุกหมวดด้วย
 *  - กลุ่มที่มีหมวดเดียว (คอมพิวเตอร์เซ็ต, แท็บเล็ต) แคปซูลคือหมวดนั้นเลย
 *  - หมวดที่เลือก: แคปซูลเหลือง + checkbox แบรนด์ (เรียงตามจำนวนสินค้า, "ไม่ระบุแบรนด์" ท้ายสุด)
 */
@Component({
  selector: 'app-category-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-tree.component.html',
  styleUrls: ['./category-tree.component.css']
})
export class CategoryTreeComponent implements OnChanges {
  @Input() categories: Category[] = [];
  /** slug ของหมวดที่เลือก (null = ทุกหมวด) */
  @Input() selectedSlug: string | null = null;
  @Input() brands: BrandCount[] = [];
  @Input() brandsLoading = false;
  /** แบรนด์ที่ติ๊กอยู่ (ตัวพิมพ์เล็ก) */
  @Input() selectedBrands: string[] = [];

  /** เลือกหมวด (slug) หรือ null = ทุกหมวด */
  @Output() categorySelect = new EventEmitter<string | null>();
  @Output() brandToggle = new EventEmitter<BrandToggleEvent>();

  /** กลุ่มที่กางอยู่ (ชื่อกลุ่ม) */
  readonly expanded = new Set<string>();
  showAllBrands = false;
  private initialised = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories'] || changes['selectedSlug']) {
      // หมวดที่เลือกอยู่ในกลุ่มไหน -> กางกลุ่มนั้น; ครั้งแรกที่ยังไม่เลือกหมวด -> กางกลุ่มแรก
      const owner = this.categories.find(root => this.contains(root, this.selectedSlug));
      if (owner) this.expanded.add(owner.name);
      else if (!this.initialised && this.categories.length) this.expanded.add(this.categories[0].name);
      if (this.categories.length) this.initialised = true;
    }
    if (changes['selectedSlug']) this.showAllBrands = false;
    if (changes['brands'] || changes['selectedBrands']) {
      // แบรนด์ที่ติ๊กไว้อยู่เกินรายการแรก -> แสดงทั้งหมดให้เห็น
      const hidden = this.sortedBrands.slice(BRAND_PREVIEW).some(b => this.isBrandChecked(b.brand));
      if (hidden) this.showAllBrands = true;
    }
  }

  /** กลุ่มที่มีหมวดเดียว -> แคปซูลคือหมวดนั้น */
  singleLeaf(root: Category): Category | null {
    return root.children?.length === 1 ? root.children[0] : null;
  }

  isExpanded(root: Category): boolean {
    return this.expanded.has(root.name);
  }

  isSelected(node: Category): boolean {
    return !!node.slug && node.slug === this.selectedSlug;
  }

  /** "อุปกรณ์ทั้งหมด" ถือว่าเลือกอยู่เมื่อไม่ได้เลือกหมวดใด */
  isAllSelected(root: Category): boolean {
    return this.selectedSlug === null && root === this.categories[0];
  }

  onGroupClick(root: Category): void {
    const leaf = this.singleLeaf(root);
    if (leaf) {
      if (!this.isSelected(leaf)) {
        this.categorySelect.emit(leaf.slug ?? null);
      } else {
        this.toggle(root);
      }
      return;
    }
    // กลุ่มรวมหลายหมวด: กดครั้งแรก = ดูทุกหมวดในกลุ่ม (เฉพาะกลุ่มแรก "อุปกรณ์ทั้งหมด") + กาง; กดซ้ำ = กาง/หุบ
    if (root === this.categories[0] && this.selectedSlug !== null) {
      this.expanded.add(root.name);
      this.categorySelect.emit(null);
      return;
    }
    this.toggle(root);
  }

  onLeafClick(node: Category): void {
    if (!this.isSelected(node)) this.categorySelect.emit(node.slug ?? null);
  }

  toggle(root: Category): void {
    if (this.expanded.has(root.name)) this.expanded.delete(root.name);
    else this.expanded.add(root.name);
  }

  // ===== แบรนด์ =====

  get sortedBrands(): BrandCount[] {
    return this.brands;
  }

  get visibleBrands(): BrandCount[] {
    return this.showAllBrands ? this.brands : this.brands.slice(0, BRAND_PREVIEW);
  }

  get hasMoreBrands(): boolean {
    return this.brands.length > BRAND_PREVIEW;
  }

  brandLabel(brand: string): string {
    return brand.toLowerCase() === UNKNOWN_BRAND ? 'ไม่ระบุแบรนด์' : brand;
  }

  brandValue(brand: string): string {
    return brand.toLowerCase();
  }

  isBrandChecked(brand: string): boolean {
    return this.selectedBrands.includes(brand.toLowerCase());
  }

  onBrandChange(brand: string, event: Event): void {
    this.brandToggle.emit({ brand: brand.toLowerCase(), checked: (event.target as HTMLInputElement).checked });
  }

  /** ไอคอนเส้นของหมวด (จาก API หรือจากชื่อหมวดใน DB ถ้า API ไม่ได้ส่งมา) */
  iconOf(node: Category, fallback = 'category'): string {
    return categoryIcon(node.icon, node.categoryKey, fallback);
  }

  trackByName(_: number, node: Category): string {
    return node.name;
  }

  private contains(node: Category, slug: string | null): boolean {
    if (!slug) return false;
    return node.slug === slug || (node.children ?? []).some(c => this.contains(c, slug));
  }
}
