import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * สวิตช์เดียวของรูปสินค้า (ค่ามาจาก environment.useRemoteProductImages)
 *   true  -> ใช้ลิงก์รูปจากเว็บร้านค้า ถ้าโหลดไม่ได้ค่อยแสดง mockup ตามหมวด
 *   false -> ใช้ mockup ตามหมวดทั้งหมด ไม่โหลดอะไรจากเว็บร้านค้าเลย
 * production เปิด / dev และ test ปิด — ถ้าร้านไหนขอให้นำรูปออก แก้ environment.ts เป็น false แล้ว build ใหม่
 */
export const USE_REMOTE_PRODUCT_IMAGES = new InjectionToken<boolean>('USE_REMOTE_PRODUCT_IMAGES', {
  providedIn: 'root',
  factory: () => environment.useRemoteProductImages
});

const MOCKUP_DIR = 'images/mockups/';
export const GENERIC_MOCKUP = `${MOCKUP_DIR}generic.svg`;

/** products.category ใน DB -> ไฟล์ mockup (ครบทุกหมวดที่มีใน DB ตอนนี้) */
const MOCKUP_BY_CATEGORY: Record<string, string> = {
  'notebook': 'notebook',
  'computer set': 'computer-set',
  'computer / pc': 'computer-set',
  'monitor': 'monitor',
  'printer': 'printer',
  'headphone': 'headphone',
  'speaker': 'speaker',
  'keyboard': 'keyboard',
  'mouse': 'mouse',
  'mouse pad': 'mouse-pad',
  'computer hardware': 'hardware',
  'accessories': 'accessories'
};

/** รูป mockup ของหมวด — หมวดที่ไม่รู้จัก/ไม่มีหมวด ใช้ mockup กลาง */
export function productMockupUrl(category: string | null | undefined): string {
  const file = MOCKUP_BY_CATEGORY[(category ?? '').trim().toLowerCase()];
  return file ? `${MOCKUP_DIR}${file}.svg` : GENERIC_MOCKUP;
}
