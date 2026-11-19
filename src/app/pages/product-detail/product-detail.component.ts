import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThaiDatePipe } from '../../pipes/thai-date.pipe';
import { ProductImageDirective } from '../../components/product-image/product-image.directive';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product/product.service';
import { Product } from '../../models/product';
import { storeDisplayName, storeLinkLabel } from '../../config/stores';
import { brandLabel } from '../../config/brand-label';
import { SeoService, truncateText } from '../../services/seo/seo.service';
import { formatThaiDate } from '../../pipes/thai-date.pipe';
import { HistoryService } from '../../services/history/history.service';
import { FavoriteService } from '../../services/favorite/favorite.service';
import { CompareService } from '../../services/compare/compare.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { CategoryService } from '../../services/category/category.service';
import { Category } from '../../models/category';
import { categoryIcon, categoryLabel } from '../../config/category-labels';
import { Observable, combineLatest, map, of } from 'rxjs';

/** หมวดของสินค้าในเมนูด้านข้างหน้าหมวดหมู่ (ชื่อไทย ไอคอน และ slug ของ /category/{slug}) */
export interface ProductCategoryHeading {
  name: string;
  icon: string;
  slug: string | null;
}

/**
 * หน้ารายละเอียดสินค้า /products/:id
 *  - แถบหัวสีกรมท่า: breadcrumb "หมวดหมู่ / รายละเอียด" (ไปหน้าหมวดของสินค้า) + ชื่อหมวดภาษาไทย + ไอคอนหมวด
 *    (ชื่อ/ไอคอน/slug จากเมนูด้านข้างหน้าหมวดหมู่ — โหลดไม่ได้ใช้ชื่อ/ไอคอนสำรองใน category-labels)
 *  - ปุ่มรายการโปรด (ระบบเดิม: guest เปิด popup ล็อกอิน) และเปรียบเทียบ (แถบเปรียบเทียบเดิม สูงสุด 4 ชิ้น)
 */
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductImageDirective, ThaiDatePipe],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent implements OnInit {
  id: number | null = null;
  product: Product | null = null;
  loading = false;
  error = '';
  /** แถบหัว — ก่อนโหลดสินค้าเสร็จเป็นหัวข้อทั่วไป */
  heading: ProductCategoryHeading = { name: 'รายละเอียดสินค้า', icon: 'category', slug: null };
  isFavorite$: Observable<boolean> = of(false);
  isInCompare$: Observable<boolean> = of(false);
  /** ครบ 4 ชิ้นแล้วและชิ้นนี้ยังไม่อยู่ในรายการ = กดเพิ่มไม่ได้ */
  compareFull$: Observable<boolean> = of(false);
  private menu: Category[] | null = null;

  constructor(private route: ActivatedRoute, private productService: ProductService, private seo: SeoService,
              private history: HistoryService, private favoriteService: FavoriteService,
              private compareService: CompareService, private authModal: AuthModalService,
              private categoryService: CategoryService) {}

  get compareMax(): number {
    return this.compareService.max;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const raw = params.get('id');
      this.id = raw ? Number(raw) : null;
      if (this.id && Number.isInteger(this.id)) {
        this.fetch(this.id);
      } else {
        this.error = 'รหัสสินค้าไม่ถูกต้อง';
      }
    });
  }

  private fetch(id: number): void {
    this.loading = true;
    this.error = '';
    this.productService.getById(id).subscribe({
      next: p => {
        this.product = p;
        this.loading = false;
        this.isFavorite$ = this.favoriteService.isFavorite$(p.id);
        this.isInCompare$ = this.compareService.isInCompare$(p.id);
        this.compareFull$ = combineLatest([this.compareService.isFull$(), this.isInCompare$])
          .pipe(map(([full, inList]) => full && !inList));
        this.loadHeading(p.category);
        // ประวัติการเข้าชม (หน้า /history) — service บันทึกเฉพาะตอนล็อกอิน
        this.history.recordView(p.id);
        this.seo.setPage({
          title: `${p.productName} - ราคาและสเปก | AuoYoo`,
          description: productDescription(p, this.price),
          canonicalPath: `/products/${p.id}`
        });
      },
      error: () => {
        this.error = 'ไม่พบสินค้านี้';
        this.loading = false;
        this.seo.setPage({ title: 'ไม่พบสินค้า | AuoYoo', description: 'ไม่พบสินค้านี้ใน AuoYoo', noindex: true });
      }
    });
  }

  /** ชื่อ/ไอคอนหมวดจากเมนูหน้าหมวดหมู่ — ระหว่างโหลดหรือโหลดไม่ได้ ใช้ค่าสำรองที่ตรงกับเมนู */
  private loadHeading(category: string): void {
    this.heading = fallbackHeading(category);
    if (this.menu) {
      this.heading = headingFromMenu(this.menu, category) ?? this.heading;
      return;
    }
    this.categoryService.getCategoryTree().subscribe({
      next: tree => {
        this.menu = tree;
        this.heading = headingFromMenu(tree, category) ?? fallbackHeading(category);
      },
      error: () => undefined
    });
  }

  /** guest -> popup ล็อกอิน (เหมือนการ์ดสินค้า); ล็อกอินแล้ว -> เพิ่ม/เอาออก (ตัวเลขใน navbar อัปเดตทันที) */
  toggleFavorite(): void {
    if (!this.product) return;
    if (this.favoriteService.requiresLogin()) {
      this.authModal.open('login', { reason: 'เข้าสู่ระบบเพื่อบันทึกรายการโปรด' });
      return;
    }
    this.favoriteService.toggle(this.product).subscribe({ error: () => undefined });
  }

  /** แถบเปรียบเทียบเดิม — เพิ่มแล้วแถบด้านล่างกางขึ้นมาเอง */
  toggleCompare(): void {
    if (this.product) this.compareService.toggle(this.product);
  }

  /** ข้อความปุ่ม/ป้ายร้าน เช่น "ดูที่ร้าน <ชื่อร้าน>" */
  get storeLabel(): string {
    return storeLinkLabel(this.product?.source);
  }

  /** แบรนด์จากร้าน หรือที่ backend หาจากชื่อสินค้า; หาไม่เจอ = "ไม่ระบุแบรนด์" */
  get brandText(): string {
    return brandLabel(this.product?.brand);
  }

  get price(): string {
    const v = this.product?.priceMin ?? this.product?.priceMax ?? 0;
    return `฿${v.toLocaleString('th-TH')}`;
  }
}

/** หมวดในเมนู (leaf) ที่ category_key มีหมวดของสินค้านี้ */
export function headingFromMenu(tree: Category[], category: string): ProductCategoryHeading | null {
  const stack = [...tree];
  while (stack.length) {
    const node = stack.shift()!;
    const keys = (node.categoryKey ?? '').split(',').map(k => k.trim());
    if (keys.includes(category)) {
      return { name: node.name, icon: categoryIcon(node.icon, node.categoryKey), slug: node.slug ?? slugOf(node.categoryKey) };
    }
    stack.push(...(node.children ?? []));
  }
  return null;
}

/** ค่าสำรองตอนเมนูยังไม่มา/โหลดไม่ได้ — ชื่อ/ไอคอนเดียวกับป้ายหมวดบนการ์ด, slug กฎเดียวกับ backend */
function fallbackHeading(category: string): ProductCategoryHeading {
  return { name: categoryLabel(category) || 'รายละเอียดสินค้า', icon: categoryIcon(null, category), slug: slugOf(category) };
}

function slugOf(key: string | null | undefined): string | null {
  const first = (key ?? '').split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return first || null;
}

/** meta description ของหน้าสินค้า: ชื่อ ราคา (ณ วันที่) ร้าน และสเปกย่อ — ไม่ซ้ำกันเพราะมีชื่อ/สเปกของสินค้านั้น */
function productDescription(p: Product, price: string): string {
  const date = formatThaiDate(p.priceAsOf);
  const store = storeDisplayName(p.source);
  const parts = [
    `${p.productName} ราคา ${price}${date ? ` (ณ วันที่ ${date})` : ''}`,
    store ? `จากร้าน ${store}` : '',
    p.specification ? `สเปก: ${p.specification}` : 'ดูสเปกและเปรียบเทียบกับรุ่นอื่นใน AuoYoo'
  ];
  return truncateText(parts.filter(Boolean).join(' '));
}
