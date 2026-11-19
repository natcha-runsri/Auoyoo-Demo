// ใช้ตอน build เดโมสำหรับ GitHub Pages (npm run build:demo -> ng build --configuration demo)
// ไม่มี backend: ทุก request ไป /api ถูกตอบด้วยข้อมูลจำลองใน src/app/demo/ (ดู demo-mode.demo.ts)
export const environment = {
  production: false,
  demo: true,
  apiUrl: '/api',
  // เดโมไม่โหลดรูปจากภายนอก — รูปสินค้าใช้ mockup SVG ตามหมวดทั้งหมด
  useRemoteProductImages: false
};
