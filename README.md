# AuoYoo Demo

เดโมหน้าเว็บของ **AuoYoo** เว็บแนะนำและเปรียบเทียบอุปกรณ์ไอทีด้วย AI ผู้ใช้บอกงบประมาณและการใช้งาน แล้วระบบจะช่วยเลือกโน้ตบุ๊ก จอ หูฟัง คีย์บอร์ด เมาส์ และอุปกรณ์อื่น ๆ พร้อมตารางเปรียบเทียบสเปกและราคา

**ลองใช้เดโม:** https://natcha-runsri.github.io/Auoyoo-Demo/

repo นี้มีเฉพาะส่วน frontend (Angular) ที่ปรับให้ทำงานได้โดยไม่มี backend ข้อมูลทุกอย่างในเดโมเป็นข้อมูลจำลอง

| ชื่อ-นามสกุล | ตำแหน่ง/หน้าที่รับผิดชอบ | GitHub |
|---|---|---|
| นายทัตพงศ์ ทองยวง | Backend Developer (REST API, ระบบแนะนำ/AI, ฐานข้อมูล, Deploy) | [@Tatphong-To](https://github.com/Tatphong-To) |
| นางสาวณัชชา รุนศรี | Frontend Developer (Angular, UX/UI): ออกแบบหน้าจอและ responsive, หน้าแรก/หมวดหมู่/รายละเอียด/เปรียบเทียบ/แชท AI/รายการโปรด/ประวัติ/โปรไฟล์, เชื่อมต่อ REST API, ทดสอบ (QA) | [@natcha-runsri](https://github.com/natcha-runsri) |

## ลองอะไรได้บ้าง

- หน้าแรก หมวดหมู่ ตัวกรองแบรนด์และช่วงราคา และค้นหาสินค้า
- หน้ารายละเอียดสินค้า และเพิ่มสินค้าลงแถบเปรียบเทียบ
- หน้าเปรียบเทียบ: ตารางสเปก บทวิเคราะห์ และถามเพิ่มเกี่ยวกับสินค้าที่เลือก
- แชทแนะนำสินค้า เช่น "โน้ตบุ๊กเล่นเกม งบ 30000" หรือ "หูฟังตัดเสียงรบกวน ไม่เกิน 5000"
- เข้าสู่ระบบ (กดปุ่ม **ลองเป็นผู้ใช้ทั่วไป** ที่แถบล่างของทุกหน้า) แล้วลองรายการโปรด ประวัติการใช้งาน แชทที่บันทึกไว้ และหน้าโปรไฟล์

## สิ่งที่ต่างจากระบบจริง

| ส่วน | ระบบจริง | เดโมนี้ |
|---|---|---|
| ข้อมูลสินค้า | ฐานข้อมูล PostgreSQL ผ่าน API | ข้อมูลจำลองประมาณ 27 รายการที่แต่งขึ้นเอง ฝังอยู่ในหน้าเว็บ |
| API | Spring Boot (`/api/*`) | `HttpInterceptor` ตอบทุก `/api/*` ในเบราว์เซอร์ ไม่มี request ออกไปไหน |
| AI แนะนำสินค้า | Ollama (LLM) ร่วมกับตัวตีความเงื่อนไข | กฎจับคำสำคัญ (หมวด งบ แบรนด์ การใช้งาน) และข้อความสำเร็จรูป |
| บัญชีผู้ใช้ | JWT, refresh cookie, OTP ทางอีเมล, Google Sign-In | token ปลอม, session ใน sessionStorage, รหัส OTP ใส่อะไรก็ได้ |
| รูปภาพ | รูปสินค้าจากร้านค้า | SVG ที่วาดขึ้นเอง |

## ข้อจำกัดของเดโม

- ข้อมูลสินค้า แบรนด์ รุ่น สเปก ราคา และร้านค้าทั้งหมด**แต่งขึ้นเอง** ส่วนรูปสินค้าและรูปประกอบเป็น **placeholder** (SVG ที่วาดเอง)
- AI **ตอบจากคำสำคัญ** ในข้อความตามกฎตายตัว **ไม่ได้ใช้โมเดลภาษา** คำถามที่ซับซ้อนจึงอาจได้คำตอบไม่ตรง
- เข้าสู่ระบบและสมัครสมาชิกรับค่าอะไรก็ได้ ไม่มีการตรวจรหัสผ่านและไม่ส่งอีเมลจริง **ไม่มี Google Sign-In**
- รายการโปรดและประวัติเก็บใน **localStorage ของเบราว์เซอร์นั้น** (key ขึ้นต้นด้วย `auoyoo-demo:`) ไม่ข้ามเครื่องหรือข้ามเบราว์เซอร์ ส่วนการเข้าสู่ระบบเก็บใน sessionStorage จึงหายเมื่อปิดแท็บ
- อัปโหลดรูปโปรไฟล์ได้แค่ดูตัวอย่างในแท็บนั้น **ไม่ถูกบันทึก** และรีเฟรชแล้วหาย
- **ไม่มีลิงก์ไปร้านค้า** ชื่อร้านในเดโมเป็นร้านสมมติ
- เปิดลิงก์หน้าลึก (เช่น `/products/101`) ได้ เพราะ GitHub Pages จะส่ง `404.html` ซึ่งเป็นสำเนาของ `index.html` แต่ search engine อาจไม่ index หน้าเหล่านี้ และไม่มี `sitemap.xml`

## Tech stack ของระบบเต็ม

ซอร์สโค้ดของระบบเต็มเป็น private repo ที่นี่มีเฉพาะ frontend สำหรับเดโม

- **Frontend:** Angular 19 (standalone components), TypeScript, RxJS
- **Backend:** Spring Boot (Java 21), Spring Security + JWT, Spring Data JPA
- **ฐานข้อมูล:** PostgreSQL
- **AI:** Ollama (LLM ที่รันเอง) ใช้ร่วมกับตัวตีความเงื่อนไขจากข้อความ
- **Deploy:** Docker Compose, Nginx, GitHub Actions

## รันเดโมในเครื่อง

ต้องใช้ Node.js 22

```bash
npm ci
npm run start:demo        # เปิด http://localhost:4200 (โหมดเดโม)
```

build แบบเดียวกับที่ขึ้น GitHub Pages:

```bash
npm run build:demo        # ผลลัพธ์อยู่ที่ dist/frontend/browser (base href = /Auoyoo-Demo/ และมี 404.html)
```

build ปกติ (`npm run build`) ยังเป็น production ที่เรียก `/api` จริงเหมือนเดิม โค้ดข้อมูลจำลองอยู่ใน `src/app/demo/` และถูกใส่เข้ามาเฉพาะ configuration `demo` ผ่าน `fileReplacements` ใน `angular.json`

GitHub Pages: workflow `.github/workflows/pages.yml` จะ build และ deploy ทุกครั้งที่ push เข้า `main` ต้องตั้ง Settings → Pages → Source เป็น **GitHub Actions**

## เครดิตรูปภาพ

- `public/images/gadget-keyboard.jpg` ภาพโดย Chris J. Davis จาก [Unsplash](https://unsplash.com/photos/PT_9ux0j-x4) (Unsplash License)
- `public/images/gadget-mouse.jpg` ภาพโดย Pascal M. จาก [Unsplash](https://unsplash.com/photos/4PchFKrUw84) (Unsplash License)
- รูปอื่นทั้งหมด (โลโก้ ภาพประกอบ และ mockup สินค้า) เป็นงานของโปรเจกต์ หรือ SVG ที่วาดขึ้นเองสำหรับเดโม
