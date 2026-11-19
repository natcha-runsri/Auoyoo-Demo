import { HistorySummary, Slice } from '../../services/history/history.service';

/** ต้องมีอย่างน้อยเท่านี้ถึงจะวิเคราะห์ (1–2 รายการได้ 100%/50% ที่ไม่มีความหมาย) */
export const MIN_SAMPLES = 3;
export const NOT_ENOUGH_DATA = 'ยังมีข้อมูลไม่พอสำหรับวิเคราะห์';

/** สีกราฟหมวดหมู่ตามลำดับ (ส้ม, กรมท่า, เหลืองอ่อน, ม่วงเทา, เหลืองทอง) — "อื่น ๆ" ใช้สีเทา */
export const CATEGORY_COLORS = ['#f07b3f', '#2c3e91', '#fddc9a', '#6b5068', '#f2a93b'];
export const OTHER_COLOR = '#c9ced8';
/** สีประจำช่วงราคา (คงที่ ไม่ขึ้นกับลำดับ) */
export const PRICE_COLORS: Record<string, string> = {
  UNDER_10K: '#a8b4da',
  '10K_20K': '#6b5068',
  '20K_40K': '#f2a93b',
  OVER_40K: '#f07b3f'
};

export function categoryColors(slices: Slice[]): string[] {
  return slices.map((s, i) => (s.key === 'OTHER' ? OTHER_COLOR : CATEGORY_COLORS[i % CATEGORY_COLORS.length]));
}

export function priceColors(slices: Slice[]): string[] {
  return slices.map(s => PRICE_COLORS[s.key] ?? OTHER_COLOR);
}

export function hasEnoughCategoryData(summary: HistorySummary | null): boolean {
  return !!summary && summary.categoryTotal >= MIN_SAMPLES;
}

export function hasEnoughPriceData(summary: HistorySummary | null): boolean {
  return !!summary && summary.priceTotal >= MIN_SAMPLES;
}

/** ข้อความอ่านกราฟให้ screen reader: "หมวดหมู่ที่สนใจ: โน้ตบุ๊ค 50%, เมาส์ 25%" */
export function chartAriaLabel(title: string, slices: Slice[], enough: boolean): string {
  if (!enough || !slices.length) return `${title}: ${NOT_ENOUGH_DATA}`;
  return `${title}: ${slices.map(s => `${s.label} ${s.percent}%`).join(', ')}`;
}

/**
 * ข้อความสรุปหมวดหมู่ (template ในโค้ด ไม่เรียก AI)
 * "จากข้อมูลการใช้งาน คุณให้ความสนใจ โน้ตบุ๊ค มากที่สุด คิดเป็น 45% ของการค้นหาและเข้าชมทั้งหมด รองลงมาคือ เมาส์ 30%"
 */
export function categoryInsight(summary: HistorySummary | null): string {
  if (!hasEnoughCategoryData(summary)) return '';
  const named = summary!.categories.filter(s => s.key !== 'OTHER');
  if (!named.length) return '';
  const [top, second, third] = named;
  if (named.length === 1) {
    return `จากข้อมูลการใช้งาน การค้นหาและเข้าชมทั้งหมดของคุณอยู่ในหมวด ${top.label}`;
  }
  if (second.percent === top.percent) {
    return `จากข้อมูลการใช้งาน คุณให้ความสนใจ ${top.label} และ ${second.label} พอ ๆ กัน (อย่างละ ${top.percent}%)`;
  }
  let text = `จากข้อมูลการใช้งาน คุณให้ความสนใจ ${top.label} มากที่สุด คิดเป็น ${top.percent}% ของการค้นหาและเข้าชมทั้งหมด`
    + ` รองลงมาคือ ${second.label} ${second.percent}%`;
  if (third) text += ` และ ${third.label} ${third.percent}%`;
  return text;
}

/**
 * ข้อความสรุปช่วงราคา
 * "ด้านงบประมาณ คุณมักดูสินค้าในช่วง 20,000–40,000 บาท คิดเป็น 50% ของรายการที่มีราคา รองลงมาคือช่วง 10,000–20,000 บาท 25%"
 */
export function priceInsight(summary: HistorySummary | null): string {
  if (!hasEnoughPriceData(summary)) return '';
  const sorted = [...summary!.priceRanges].sort((a, b) => b.count - a.count);
  const [top, second] = sorted;
  if (!second) {
    return `ด้านงบประมาณ สินค้าและงบที่คุณสนใจทั้งหมดอยู่ในช่วง ${top.label} บาท`;
  }
  if (second.percent === top.percent) {
    return `ด้านงบประมาณ คุณสนใจสินค้าช่วง ${top.label} บาท และ ${second.label} บาท พอ ๆ กัน (อย่างละ ${top.percent}%)`;
  }
  return `ด้านงบประมาณ คุณมักดูสินค้าในช่วง ${top.label} บาท คิดเป็น ${top.percent}% ของรายการที่มีราคา`
    + ` รองลงมาคือช่วง ${second.label} บาท ${second.percent}%`;
}
