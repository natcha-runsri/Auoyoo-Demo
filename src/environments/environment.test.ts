// ใช้ตอนรันเทสต์ (ng test) — ดู fileReplacements ของ "test" ใน angular.json
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  // เทสต์ห้ามโหลดรูปจากเว็บร้านค้าเด็ดขาด (มี guard ใน src/testing/store-domain-guard.spec.ts คอยจับอีกชั้น)
  useRemoteProductImages: false
};
