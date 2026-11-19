export const environment = {
  production: false,
  /** โหมดเดโม (ข้อมูลจำลองแทน /api) — true เฉพาะ environment.demo.ts */
  demo: false,
  apiUrl: 'http://localhost:8080/api',
  // dev: ห้ามโหลดรูปจากเว็บร้านค้า (ลดโอกาสโดนร้านบล็อก) — ใช้รูป mockup แทน
  useRemoteProductImages: false
};
