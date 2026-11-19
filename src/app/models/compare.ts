import { Product } from './product';

/** GET /api/products/compare-table — ตารางเปรียบเทียบที่ backend แยกสเปกเป็นหัวข้อแล้ว (ไม่ใช้ AI) */
export interface CompareTable {
  products: CompareTableProduct[];
  /** แถวของตาราง — values เรียงตาม products (null = ไม่มีข้อมูล) */
  rows: CompareRow[];
  /** สินค้าทุกชิ้นเป็นประเภทเดียวกัน (เทียบตรง ๆ ได้) */
  sameKind: boolean;
  /** ราคาถูกสุด — คำนวณจากราคาจริงฝั่ง backend ไม่ใช่ AI */
  cheapestIds: number[];
}

export interface CompareTableProduct {
  product: Product;
  /** ชื่อหมวดภาษาไทยตามเมนูด้านข้างหน้าหมวดหมู่ */
  categoryLabel: string;
  categoryKey: string;
  kind: string;
  kindLabel: string;
}

export interface CompareRow {
  key: string;
  label: string;
  /** basic = ราคา/แบรนด์/หมวด/ร้าน, spec = หัวข้อตามประเภทสินค้า, extra = หัวข้อที่สเปกเขียนตรงกันหลายชิ้น */
  group: 'basic' | 'spec' | 'extra';
  values: (string | null)[];
  /** index ของสินค้าที่ค่าดีที่สุดในแถวนี้ */
  best: number[];
}

/** POST /api/recommend/compare-analysis */
export interface CompareAnalysis {
  sameKind: boolean;
  overview: string;
  products: { id: number; strengths: string[]; caveats: string[]; suitedFor: string }[];
  recommendation: { id: number; reason: string } | null;
  scenarios: { condition: string; productId: number }[];
  bestValueId: number | null;
  topSpecId: number | null;
  analyzedAt: string;
  /** วันที่ข้อมูลราคาล่าสุดของชุดนี้ "yyyy-MM-dd" */
  dataAsOf: string | null;
  cached: boolean;
}
