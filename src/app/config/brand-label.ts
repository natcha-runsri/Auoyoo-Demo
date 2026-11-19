/** scraper ใส่ "Unknown" ให้สินค้าที่ร้านไม่ระบุแบรนด์ (backend หาแบรนด์จากชื่อสินค้าให้แล้ว ที่เหลือคือหาไม่เจอจริง) */
export const UNKNOWN_BRAND = 'unknown';

export function isKnownBrand(brand: string | null | undefined): brand is string {
  return !!brand && !!brand.trim() && brand.trim().toLowerCase() !== UNKNOWN_BRAND;
}

/** ชื่อแบรนด์ที่ใช้แสดง — ไม่มี/Unknown = "ไม่ระบุแบรนด์" */
export function brandLabel(brand: string | null | undefined): string {
  return isKnownBrand(brand) ? brand.trim() : 'ไม่ระบุแบรนด์';
}
