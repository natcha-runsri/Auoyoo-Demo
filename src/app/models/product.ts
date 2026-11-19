export interface Product {
  id: number;
  category: string;
  brand?: string;
  productName: string;
  specification?: string;
  priceMin?: number;
  priceMax?: number;
  url: string;
  image?: string;
  source?: string;
  /** วันที่ดึงราคามาจากร้าน "yyyy-MM-dd" (products.scrape_datetime) */
  priceAsOf?: string | null;
}

/** สินค้าในรายการโปรด (/api/favorites) = Product + เวลาบันทึก + ป้ายสเปกเด่น */
export interface FavoriteProduct extends Product {
  /** ISO instant ที่กดบันทึก — null/ไม่มี = รายการเก่าที่ไม่รู้เวลา */
  savedAt?: string | null;
  /** สเปกเด่นไม่เกิน 3 อัน (backend SpecHighlights) */
  highlights?: string[];
}

// รูปแบบ Page<T> ที่ Spring Data ส่งกลับมาให้อัตโนมัติ
export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number; // หน้าปัจจุบัน (เริ่มจาก 0)
  size: number;
}
