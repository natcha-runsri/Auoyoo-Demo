export interface Category {
  name: string;
  icon?: string;
  count?: number;
  categoryKey?: string;
  /** URL หน้าหมวด /category/{slug} (มาจาก backend เดียวกับ sitemap) */
  slug?: string | null;
  children?: Category[];
  expanded?: boolean;
  loadingBrands?: boolean;
  checked?: boolean;
}
