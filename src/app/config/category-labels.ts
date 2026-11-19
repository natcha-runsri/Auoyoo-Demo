/**
 * ชื่อภาษาไทยของ products.category (ป้ายหมวดบนการ์ดสินค้า) — ให้ตรงกับชื่อหมวดย่อยใน category_menu / category_group
 * หมวดที่ไม่รู้จักแสดงชื่อเดิมจาก DB
 */
export const CATEGORY_LABELS: Record<string, string> = {
  'Notebook': 'โน้ตบุ๊ก',
  'Headphone': 'หูฟัง',
  'Speaker': 'ลำโพง',
  'Printer': 'เครื่องพิมพ์',
  'Accessories': 'อุปกรณ์เสริม',
  'Keyboard': 'คีย์บอร์ด',
  'Mouse': 'เมาส์',
  'Mouse Pad': 'แผ่นรองเมาส์',
  'Computer Hardware': 'ฮาร์ดแวร์คอมพิวเตอร์',
  'Monitor': 'จอมอนิเตอร์',
  'Computer Set': 'คอมพิวเตอร์เซ็ต',
  'Computer / PC': 'คอมพิวเตอร์เซ็ต',
  'Tablet': 'แท็บเล็ต'
};

/**
 * ไอคอนเส้น (Material Symbols) ของแต่ละหมวด — ใช้เมื่อ API ไม่ได้ส่ง icon มา (เช่น backend/DB ยังไม่ได้รัน migration ใหม่)
 * ให้ตรงกับคอลัมน์ icon ใน category_menu (migration 012)
 */
export const CATEGORY_ICONS: Record<string, string> = {
  'Accessories': 'cable',
  'Computer Hardware': 'memory',
  'Headphone': 'headphones',
  'Keyboard': 'keyboard',
  'Monitor': 'monitor',
  'Mouse': 'mouse',
  'Mouse Pad': 'rectangle',
  'Notebook': 'laptop_chromebook',
  'Printer': 'print',
  'Speaker': 'speaker',
  'Computer Set': 'desktop_windows',
  'Computer / PC': 'desktop_windows',
  'Tablet': 'tablet_android'
};

/** ไอคอนของหมวด: icon จาก API ก่อน ไม่มีค่อยดูจาก category_key ตัวแรก */
export function categoryIcon(icon: string | null | undefined, categoryKey: string | null | undefined, fallback = 'category'): string {
  if (icon) return icon;
  const first = categoryKey?.split(',')[0]?.trim();
  return (first && CATEGORY_ICONS[first]) || fallback;
}

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return '';
  return CATEGORY_LABELS[category] ?? category;
}
