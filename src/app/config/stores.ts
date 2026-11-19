/**
 * products.source -> ชื่อร้านที่แสดงให้ผู้ใช้เห็น
 * repo เดโมนี้ไม่มีชื่อร้านจริง — มีเฉพาะร้านสมมติที่ข้อมูลจำลองใช้ (ไม่มีลิงก์ออกไปภายนอก)
 */
const STORE_NAMES: Record<string, string> = {
  'demo-a': 'ร้านตัวอย่าง A',
  'demo-b': 'ร้านตัวอย่าง B'
};

/** ชื่อร้านต้นทางของสินค้า — ไม่รู้จักร้าน -> null (ปุ่มจะใช้ข้อความกลาง ๆ แทน) */
export function storeDisplayName(source: string | null | undefined): string | null {
  return STORE_NAMES[(source ?? '').trim().toLowerCase()] ?? null;
}

/** ข้อความปุ่มลิงก์ไปร้าน เช่น "ดูที่ร้าน ร้านตัวอย่าง A" */
export function storeLinkLabel(source: string | null | undefined): string {
  const name = storeDisplayName(source);
  return name ? `ดูที่ร้าน ${name}` : 'ดูที่ร้านค้าต้นทาง';
}
