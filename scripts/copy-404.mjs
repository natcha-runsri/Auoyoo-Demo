// GitHub Pages ไม่มี SPA fallback: เปิด /Auoyoo-Demo/products/101 ตรง ๆ จะได้ 404.html
// -> คัดลอก index.html เป็น 404.html ให้ Angular router รับต่อ
import { copyFileSync, existsSync } from 'node:fs';

const dir = 'dist/frontend/browser';
if (!existsSync(`${dir}/index.html`)) {
  console.error(`ไม่พบ ${dir}/index.html — build ไม่สำเร็จ?`);
  process.exit(1);
}
copyFileSync(`${dir}/index.html`, `${dir}/404.html`);
console.log(`copied ${dir}/index.html -> ${dir}/404.html`);
