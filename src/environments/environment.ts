// ใช้ตอน build production (ng build) — dev ใช้ environment.development.ts, เทสต์ใช้ environment.test.ts
export const environment = {
  production: false,
  // relative: เว็บกับ API อยู่โดเมนเดียวกัน — nginx ใน container frontend ส่ง /api และ /uploads ต่อให้ backend
  apiUrl: '/api',
  /**
   * true = แสดงรูปสินค้าจากลิงก์เว็บร้านค้า (ลิงก์รูปที่ backend ส่งมา)
   * false = ใช้รูป mockup ตามหมวดทั้งหมด และไม่โหลดอะไรจากเว็บร้านค้าเลย (เช่น ร้านขอให้นำรูปออก)
   * เปิดเฉพาะ production — dev/test ปิดไว้เสมอ กันยิงเว็บร้านค้าระหว่างพัฒนา
   */
  useRemoteProductImages: true
};
