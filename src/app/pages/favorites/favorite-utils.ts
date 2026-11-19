import { FavoriteProduct } from '../../models/product';
import { formatThaiDate } from '../../pipes/thai-date.pipe';

export type FavoriteSort = 'latest' | 'price-asc' | 'price-desc';

export interface SortOption {
  value: FavoriteSort;
  /** ข้อความในเมนู/บนปุ่ม — ลูกศรแสดงเป็นไอคอนแยก */
  from?: string;
  to?: string;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'latest', label: 'ล่าสุด' },
  { value: 'price-asc', label: 'ราคา: ต่ำ → สูง', from: 'ราคา: ต่ำ', to: 'สูง' },
  { value: 'price-desc', label: 'ราคา: สูง → ต่ำ', from: 'ราคา: สูง', to: 'ต่ำ' }
];

export function parseSort(value: string | null | undefined): FavoriteSort {
  return value === 'price-asc' || value === 'price-desc' ? value : 'latest';
}

function priceOf(p: FavoriteProduct): number | null {
  return p.priceMin ?? p.priceMax ?? null;
}

/**
 * เรียงรายการโปรด: latest = ลำดับจาก backend (บันทึกล่าสุดก่อน)
 * เรียงราคา: สินค้าที่ไม่มีราคาอยู่ท้ายสุดทั้งสองแบบ, ราคาเท่ากันคงลำดับเดิม
 */
export function sortFavorites(items: FavoriteProduct[], sort: FavoriteSort): FavoriteProduct[] {
  if (sort === 'latest') return items;
  const dir = sort === 'price-asc' ? 1 : -1;
  return items
    .map((item, index) => ({ item, index, price: priceOf(item) }))
    .sort((a, b) => {
      if (a.price === null && b.price === null) return a.index - b.index;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return (a.price - b.price) * dir || a.index - b.index;
    })
    .map(x => x.item);
}

/**
 * "บันทึกเมื่อ ..." : เมื่อสักครู่ / 5 นาทีก่อน / 2 ชั่วโมงก่อน / 3 วันก่อน / เกิน 30 วัน = วันที่ไทย
 * ไม่มีเวลา (รายการเก่า) -> '' = ซ่อนบรรทัด
 */
export function savedAgo(savedAt: string | null | undefined, now: Date = new Date()): string {
  if (!savedAt) return '';
  const time = new Date(savedAt).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor(Math.max(0, now.getTime() - time) / 60_000);
  if (minutes < 1) return 'บันทึกเมื่อสักครู่';
  if (minutes < 60) return `บันทึกเมื่อ ${minutes} นาทีก่อน`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `บันทึกเมื่อ ${hours} ชั่วโมงก่อน`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return `บันทึกเมื่อ ${days} วันก่อน`;
  // วันที่ตามเวลาไทย
  const bangkok = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(time));
  return `บันทึกเมื่อ ${formatThaiDate(bangkok)}`;
}
