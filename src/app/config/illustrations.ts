/**
 * ภาพประกอบใน popup หน้าโปรไฟล์ — ตอนนี้เป็น SVG ชั่วคราว รอไฟล์จริงจากผู้ออกแบบ
 * ได้ไฟล์จริงแล้ว: วางไฟล์ใน frontend/public/images/illustrations/ แล้วแก้ path ที่นี่ที่เดียว (png/svg/webp ได้หมด)
 */
export const ILLUSTRATIONS = {
  /** ซองจดหมายฟ้า-ขาวมีเครื่องหมายถูก — ขั้นยืนยันตัวตนด้วยรหัสผ่านปัจจุบัน */
  verifyIdentity: 'images/illustrations/verify-identity.svg',
  /** ซองจดหมายเหลืองมีวงกลมเขียวเครื่องหมายถูก — ขั้นเสร็จสิ้น */
  done: 'images/illustrations/done.svg'
} as const;
