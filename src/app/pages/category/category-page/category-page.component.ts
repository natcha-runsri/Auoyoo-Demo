import { Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, combineLatest, of, shareReplay } from 'rxjs';
import { CategoryTreeComponent, BrandToggleEvent } from '../category-tree/category-tree.component';
import { ProductCardComponent } from '../product-card/product-card.component';
import { PriceRange, PriceRangeComponent } from '../price-range/price-range.component';
import { BrandCount, CategoryService } from '../../../services/category/category.service';
import { ProductService } from '../../../services/product/product.service';
import { Category } from '../../../models/category';
import { Product } from '../../../models/product';
import { SeoService } from '../../../services/seo/seo.service';
import { CATEGORY_INDEX_SEO } from '../../../services/seo/page-seo';
import { HistoryService } from '../../../services/history/history.service';

export type PageItem = number | '...';

/** 3x3 ตามดีไซน์ */
export const PAGE_SIZE = 9;

/**
 * URL หมวดภาษาไทยแบบเก่า (ลิงก์หน้าหลักเดิม / ชื่อหมวดเดิมใน DB / ลิงก์ที่ถูกแชร์ไปแล้ว) -> slug ปัจจุบัน
 * นอกจากนี้ slug ที่ตรงกับ "ชื่อหมวด" ในเมนู หรือ slug เก่าของหมวดย่อยที่ถูกรวมกลุ่ม (เช่น /category/speaker) ก็พาไปให้เอง
 */
export const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  // ลิงก์หน้าหลักแบบเก่า / ชื่อหมวดเดิม
  'โน้ตบุ๊ค': 'notebook',
  'เครื่องเสียง': 'headphone',
  'อุปกรณ์เครื่องเสียง': 'headphone',
  'เครื่องพิมพ์': 'printer',
  'คีย์บอร์ด-เมาส์': 'keyboard',
  'คีย์บอร์ด & เมาส์': 'keyboard',
  // slug กลุ่มรวมที่เคยใช้ช่วงสั้น ๆ (migration 011)
  'audio': 'headphone',
  'keyboard-mouse': 'keyboard'
};

/** กฎเดียวกับ CategoryService.slugOf ฝั่ง backend: "Mouse Pad" -> "mouse-pad" */
export function slugOfKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** หา node แรกในต้นไม้หมวดที่ตรงเงื่อนไข */
function findNode(nodes: Category[], match: (node: Category) => boolean): Category | undefined {
  for (const node of nodes) {
    if (match(node)) return node;
    const child = findNode(node.children ?? [], match);
    if (child) return child;
  }
  return undefined;
}

function positiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * เลขหน้าที่จะแสดง (เริ่ม 1) แบบมีจุดไข่ปลา — siblings = จำนวนหน้าข้าง ๆ หน้าปัจจุบัน (มือถือใช้ 0)
 * เช่น 14 หน้า อยู่หน้า 1: 1 2 3 4 5 … 14 / อยู่หน้า 7: 1 … 6 7 8 … 14
 */
export function buildPageItems(page: number, count: number, siblings = 1): PageItem[] {
  if (count <= 0) return [];
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  if (count <= 5 + siblings * 2) return range(1, count);
  const start = Math.max(Math.min(page - siblings, count - siblings * 2 - 2), 3);
  const end = Math.min(Math.max(page + siblings, siblings * 2 + 3), count - 2);
  return [
    1,
    start > 3 ? '...' : 2,
    ...range(start, end),
    end < count - 2 ? '...' : count - 1,
    count
  ];
}

/**
 * หน้า /category และ /category/{slug}
 * ตัวกรองทั้งหมดอยู่ใน URL (แหล่งความจริงเดียว — รีเฟรช/แชร์ลิงก์/ปุ่มย้อนกลับได้ผลเดิม):
 *   /category/notebook?brand=novaro&brand=kitora&min=10000&max=40000&page=2&q=คำค้น
 * เปลี่ยนตัวกรอง = เปลี่ยน URL แล้วโหลดใหม่จาก URL; เปลี่ยนตัวกรองแล้วกลับหน้า 1
 */
@Component({
  selector: 'app-category-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CategoryTreeComponent, ProductCardComponent, PriceRangeComponent],
  templateUrl: './category-page.component.html',
  styleUrls: ['./category-page.component.css']
})
export class CategoryPageComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);

  categories: Category[] = [];
  /** หมวดที่เลือก (null = ทุกหมวด) */
  selectedNode: Category | null = null;
  products: Product[] = [];
  totalPages = 0;
  totalElements = 0;
  loading = true;
  error = '';

  // ตัวกรองจาก URL
  /** ข้อความในช่องค้นหา */
  searchKeyword = '';
  keyword = '';
  brands: string[] = [];
  price: PriceRange = { min: null, max: null };
  /** หน้าปัจจุบัน เริ่ม 1 */
  page = 1;

  // ข้อมูลประกอบ sidebar
  brandOptions: BrandCount[] = [];
  brandsLoading = false;
  priceFloor = 0;
  priceCeiling = 0;

  // มือถือ
  filtersOpen = false;
  compactPager = false;

  readonly pageSize = PAGE_SIZE;
  readonly skeletons = Array.from({ length: PAGE_SIZE }, (_, i) => i);

  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;
  @ViewChild('filterToggle') private filterToggle?: ElementRef<HTMLButtonElement>;
  @ViewChild('sidebar') private sidebar?: ElementRef<HTMLElement>;

  private categoryKey: string | null | undefined = undefined;
  private productsSub?: Subscription;
  private brandsSub?: Subscription;
  private boundsSub?: Subscription;
  private compactQuery?: MediaQueryList;
  private readonly onCompactChange = (e: MediaQueryListEvent) => (this.compactPager = e.matches);

  constructor(
    private categoryService: CategoryService,
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private seo: SeoService,
    private history: HistoryService
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.compactQuery = window.matchMedia('(max-width: 767px)');
      this.compactPager = this.compactQuery.matches;
      this.compactQuery.addEventListener?.('change', this.onCompactChange);
    }
    const tree$ = this.categoryService.getCategoryTree().pipe(catchError(() => of([] as Category[])), shareReplay(1));
    // slug + query อ่านจาก observable ทั้งคู่ — ตอนสร้าง component ใหม่ snapshot อาจยังเป็นค่าเก่า
    combineLatest([tree$, this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([tree, params, query]) => this.applyRoute(tree, params, query));
  }

  ngOnDestroy(): void {
    this.productsSub?.unsubscribe();
    this.brandsSub?.unsubscribe();
    this.boundsSub?.unsubscribe();
    this.compactQuery?.removeEventListener?.('change', this.onCompactChange);
    this.lockScroll(false);
  }

  // ===================== URL -> state =====================

  private applyRoute(tree: Category[], params: ParamMap, query: ParamMap): void {
    if (this.categories !== tree) this.categories = tree;
    const slug = params.get('slug');
    let node: Category | null = null;
    if (slug) {
      node = findNode(tree, n => !!n.slug && n.slug === slug) ?? null;
      if (!node) {
        const target = this.legacyTarget(tree, slug);
        if (target) {
          // URL เก่า -> slug ปัจจุบัน (replaceUrl: ปุ่มย้อนกลับไม่วนกลับมาหน้าเก่า) คงตัวกรองอื่นไว้
          void this.router.navigate(['/category', target], { replaceUrl: true, queryParams: this.route.snapshot.queryParams });
          return;
        }
      }
    }

    this.selectedNode = node;
    this.keyword = (query.get('q') ?? '').trim();
    this.searchKeyword = this.keyword;
    this.brands = Array.from(new Set(query.getAll('brand').map(b => b.trim().toLowerCase()).filter(Boolean)));
    const min = positiveInt(query.get('min'));
    const max = positiveInt(query.get('max'));
    const [lo, hi] = min !== null && max !== null && min > max ? [max, min] : [min, max];
    if (lo !== this.price.min || hi !== this.price.max) this.price = { min: lo, max: hi };
    this.page = Math.max(1, positiveInt(query.get('page')) ?? 1);

    const key = node?.categoryKey ?? null;
    if (key !== this.categoryKey) {
      this.categoryKey = key;
      this.loadBrands(key);
      this.loadBounds(key);
      this.updateSeo(slug, node);
    }
    this.loadProducts();
  }

  private legacyTarget(tree: Category[], slug: string): string | null {
    const legacy = LEGACY_CATEGORY_SLUGS[slug];
    if (legacy && findNode(tree, n => n.slug === legacy)) return legacy;
    // ชื่อหมวดในเมนู (/category/จอมอนิเตอร์) หรือ slug เก่าของหมวดย่อยที่ถูกรวม (/category/speaker -> audio)
    const byName = findNode(tree, n => !!n.slug && n.name === slug);
    if (byName?.slug) return byName.slug;
    const byKey = findNode(tree, n => !!n.slug && !!n.categoryKey && n.categoryKey.split(',').some(k => slugOfKey(k) === slug));
    return byKey?.slug ?? null;
  }

  private updateSeo(slug: string | null, node: Category | null): void {
    if (node?.slug) {
      this.seo.setPage({
        title: `${node.name} แนะนำและเปรียบเทียบ | AuoYoo`,
        description: `เปรียบเทียบราคาและสเปก${node.name}${node.count ? ` ${node.count.toLocaleString('th-TH')} รายการ` : ''} `
          + 'กรองตามแบรนด์และงบประมาณ พร้อม AI ช่วยแนะนำ',
        canonicalPath: `/category/${node.slug}`
      });
    } else if (slug) {
      // slug ไม่รู้จัก (เช่น แบตสำรอง ที่ยังไม่มีหมวด) -> แสดงทุกหมวด และบอก Google ว่าหน้าหลักคือ /category
      this.seo.setPage(CATEGORY_INDEX_SEO);
    }
  }

  // ===================== โหลดข้อมูล =====================

  private loadProducts(): void {
    this.productsSub?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.productsSub = this.productService.search({
      category: this.categoryKey ?? undefined,
      brand: this.brands.length ? this.brands : undefined,
      minPrice: this.price.min ?? undefined,
      maxPrice: this.price.max ?? undefined,
      keyword: this.keyword || undefined,
      page: this.page - 1,
      size: this.pageSize
    }).subscribe({
      next: response => {
        // เลขหน้าใน URL เกินจำนวนหน้าที่มี -> ไปหน้าสุดท้าย
        if (response.totalPages > 0 && this.page > response.totalPages) {
          this.navigate({ page: response.totalPages === 1 ? null : response.totalPages }, true);
          return;
        }
        this.products = response.content;
        this.totalPages = response.totalPages;
        this.totalElements = response.totalElements;
        this.loading = false;
      },
      error: () => {
        this.products = [];
        this.totalPages = 0;
        this.loading = false;
        this.error = 'โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      }
    });
  }

  private loadBrands(key: string | null): void {
    this.brandsSub?.unsubscribe();
    this.brandOptions = [];
    if (!key) {
      this.brandsLoading = false;
      return;
    }
    this.brandsLoading = true;
    this.brandsSub = this.categoryService.getBrands(key).subscribe({
      next: brands => {
        this.brandOptions = brands;
        this.brandsLoading = false;
      },
      error: () => (this.brandsLoading = false)
    });
  }

  private loadBounds(key: string | null): void {
    this.boundsSub?.unsubscribe();
    this.boundsSub = this.productService.getPriceRange(key).subscribe({
      next: range => {
        this.priceFloor = range.min == null ? 0 : Math.floor(range.min);
        this.priceCeiling = range.max == null ? 0 : Math.ceil(range.max);
      },
      error: () => {
        this.priceFloor = 0;
        this.priceCeiling = 0;
      }
    });
  }

  retry(): void {
    this.loadProducts();
  }

  // ===================== state -> URL =====================

  /** คลิกหมวดใน sidebar -> /category/{slug} (ล้างแบรนด์/ราคา/หน้า เพราะเป็นของหมวดเดิม; คงคำค้นไว้) */
  onCategorySelect(slug: string | null): void {
    const queryParams = this.keyword ? { q: this.keyword } : {};
    void this.router.navigate(slug ? ['/category', slug] : ['/category'], { queryParams });
  }

  onBrandToggle(event: BrandToggleEvent): void {
    const next = event.checked
      ? Array.from(new Set([...this.brands, event.brand]))
      : this.brands.filter(b => b !== event.brand);
    this.navigate({ brand: next });
  }

  onPriceRangeChange(range: PriceRange): void {
    this.navigate({ min: range.min, max: range.max });
  }

  /**
   * ค้นหาด้วยคำ: ไปที่ "ทุกหมวด" พร้อมคำค้น (/category?q=...) ล้างตัวกรองอื่นทิ้ง
   * บันทึกประวัติเฉพาะตอนล็อกอิน (HistoryService เช็กเอง)
   */
  onSearch(): void {
    const keyword = this.searchKeyword.trim();
    this.history.recordSearch(keyword);
    void this.router.navigate(['/category'], { queryParams: keyword ? { q: keyword } : {} });
  }

  get hasActiveFilters(): boolean {
    return this.brands.length > 0 || this.price.min !== null || this.price.max !== null || !!this.keyword;
  }

  get activeFilterCount(): number {
    return this.brands.length + (this.price.min !== null || this.price.max !== null ? 1 : 0) + (this.keyword ? 1 : 0);
  }

  /** ล้างแบรนด์ ช่วงราคา และคำค้น (คงหมวดที่เลือกไว้) */
  clearFilters(): void {
    this.searchKeyword = '';
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goToPage(item: PageItem): void {
    if (item === '...' || item < 1 || item > this.totalPages || item === this.page) return;
    this.navigate({ page: item === 1 ? null : item }, false, true);
    this.scrollToList();
  }

  get pageItems(): PageItem[] {
    return buildPageItems(this.page, this.totalPages, this.compactPager ? 0 : 1);
  }

  get selectedSlug(): string | null {
    return this.selectedNode?.slug ?? null;
  }

  trackByProductId(_: number, product: Product): number {
    return product.id;
  }

  /**
   * เปลี่ยนตัวกรองใน URL — เปลี่ยนตัวกรองแล้วกลับหน้า 1 เสมอ (ยกเว้นตอนเปลี่ยนหน้าเอง)
   * ค่าว่าง/null = เอาออกจาก URL
   */
  private navigate(change: { brand?: string[]; min?: number | null; max?: number | null; page?: number | null },
                   replaceUrl = false, keepPage = false): void {
    const queryParams: Params = {};
    if ('brand' in change) queryParams['brand'] = change.brand && change.brand.length ? change.brand : null;
    if ('min' in change) queryParams['min'] = change.min ?? null;
    if ('max' in change) queryParams['max'] = change.max ?? null;
    queryParams['page'] = keepPage || 'page' in change ? change.page ?? null : null;
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl });
  }

  /** เปลี่ยนหน้าแล้วเลื่อนขึ้นไปบนสุดของรายการสินค้า (เฉพาะเมื่อหัวรายการเลื่อนพ้นจอ/เข้าไปอยู่ใต้ header ที่ติดบนจอแล้ว) */
  private scrollToList(): void {
    const el = this.listTop?.nativeElement;
    const headerH = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-header-h')) || 0;
    if (el && el.getBoundingClientRect().top < headerH) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ===================== แผงตัวกรองบนมือถือ =====================

  openFilters(): void {
    this.filtersOpen = true;
    this.lockScroll(true);
    setTimeout(() => this.sidebar?.nativeElement.querySelector<HTMLElement>('button, input')?.focus());
  }

  closeFilters(): void {
    if (!this.filtersOpen) return;
    this.filtersOpen = false;
    this.lockScroll(false);
    this.filterToggle?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeFilters();
  }

  private lockScroll(lock: boolean): void {
    if (typeof document !== 'undefined') document.body.style.overflow = lock ? 'hidden' : '';
  }
}
