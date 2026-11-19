import { Category } from '../models/category';
import { Product } from '../models/product';

/**
 * ข้อมูลสินค้าจำลองของเดโม — แต่งขึ้นเองทั้งหมด (แบรนด์ รุ่น สเปก ราคา และร้านเป็นของสมมติ)
 * ไม่ได้มาจากเว็บร้านค้าใด ๆ และไม่มีลิงก์ออกไปภายนอก (url ว่าง, image ว่าง = ใช้ mockup SVG ตามหมวด)
 */
export interface DemoProduct {
  id: number;
  category: string;
  brand: string;
  name: string;
  price: number;
  /** ราคาสูงสุด (ไม่ใส่ = ราคาเดียว) */
  priceMax?: number;
  source: 'demo-a' | 'demo-b';
  /** สเปกเป็นหัวข้อ — ใช้ทำข้อความสเปก ตารางเปรียบเทียบ และผลวิเคราะห์ */
  specs: Record<string, string>;
  /** คำที่ใช้จับคู่กับคำถามของ AI จำลอง เช่น เล่นเกม ทำงาน พกพา */
  tags: string[];
}

export const DEMO_PRICE_AS_OF = '2026-11-01';

export const DEMO_PRODUCTS: DemoProduct[] = [
  // ---- โน้ตบุ๊ก ----
  { id: 101, category: 'Notebook', brand: 'Novaro', name: 'Novaro AirLite 14', price: 18990, source: 'demo-a',
    specs: { 'CPU': 'NV Core 5 (8 คอร์)', 'RAM': '16 GB', 'Storage': '512 GB SSD', 'Display': '14" FHD IPS', 'GPU': 'กราฟิกออนบอร์ด', 'Weight': '1.3 kg', 'Battery': '12 ชม.' },
    tags: ['ทำงาน', 'เรียน', 'พกพา', 'office', 'student'] },
  { id: 102, category: 'Notebook', brand: 'Novaro', name: 'Novaro AirLite 16 Pro', price: 32990, source: 'demo-b',
    specs: { 'CPU': 'NV Core 7 (12 คอร์)', 'RAM': '32 GB', 'Storage': '1 TB SSD', 'Display': '16" 2.5K IPS', 'GPU': 'กราฟิกออนบอร์ด', 'Weight': '1.8 kg', 'Battery': '14 ชม.' },
    tags: ['ทำงาน', 'โปรแกรมมิ่ง', 'ตัดต่อ', 'programmer'] },
  { id: 103, category: 'Notebook', brand: 'Kitora', name: 'Kitora Blaze G15', price: 29990, source: 'demo-a',
    specs: { 'CPU': 'KT Ryze 7 (8 คอร์)', 'RAM': '16 GB', 'Storage': '1 TB SSD', 'Display': '15.6" FHD 165Hz', 'GPU': 'การ์ดจอแยก 6 GB', 'Weight': '2.3 kg', 'Battery': '6 ชม.' },
    tags: ['เล่นเกม', 'เกม', 'gaming', 'ตัดต่อ'] },
  { id: 104, category: 'Notebook', brand: 'Kitora', name: 'Kitora Blaze G17 Max', price: 45990, source: 'demo-b',
    specs: { 'CPU': 'KT Ryze 9 (16 คอร์)', 'RAM': '32 GB', 'Storage': '2 TB SSD', 'Display': '17.3" QHD 240Hz', 'GPU': 'การ์ดจอแยก 12 GB', 'Weight': '2.9 kg', 'Battery': '5 ชม.' },
    tags: ['เล่นเกม', 'เกม', 'gaming', 'ตัดต่อ', 'สตรีม'] },
  { id: 105, category: 'Notebook', brand: 'Velunt', name: 'Velunt Study 14', price: 12490, source: 'demo-a',
    specs: { 'CPU': 'VL Mobile 3 (4 คอร์)', 'RAM': '8 GB', 'Storage': '256 GB SSD', 'Display': '14" FHD', 'GPU': 'กราฟิกออนบอร์ด', 'Weight': '1.4 kg', 'Battery': '9 ชม.' },
    tags: ['เรียน', 'นักเรียน', 'student', 'พกพา', 'ประหยัด'] },
  { id: 106, category: 'Notebook', brand: 'Velunt', name: 'Velunt Creator 15 OLED', price: 38990, source: 'demo-b',
    specs: { 'CPU': 'VL Mobile 7 (12 คอร์)', 'RAM': '32 GB', 'Storage': '1 TB SSD', 'Display': '15.6" 3K OLED', 'GPU': 'การ์ดจอแยก 8 GB', 'Weight': '1.9 kg', 'Battery': '10 ชม.' },
    tags: ['ตัดต่อ', 'กราฟิก', 'ออกแบบ', 'designer', 'ทำงาน'] },

  // ---- จอมอนิเตอร์ ----
  { id: 201, category: 'Monitor', brand: 'Pixora', name: 'Pixora View 24 FHD', price: 3290, source: 'demo-a',
    specs: { 'Size': '24"', 'Resolution': '1920x1080', 'Refresh rate': '100 Hz', 'Panel': 'IPS', 'Ports': 'HDMI, DP' },
    tags: ['ทำงาน', 'เรียน', 'ประหยัด', 'office'] },
  { id: 202, category: 'Monitor', brand: 'Pixora', name: 'Pixora Arena 27 QHD', price: 8990, source: 'demo-b',
    specs: { 'Size': '27"', 'Resolution': '2560x1440', 'Refresh rate': '180 Hz', 'Panel': 'Fast IPS', 'Ports': 'HDMI x2, DP' },
    tags: ['เล่นเกม', 'เกม', 'gaming'] },
  { id: 203, category: 'Monitor', brand: 'Arvenn', name: 'Arvenn Studio 32 4K', price: 15990, source: 'demo-a',
    specs: { 'Size': '32"', 'Resolution': '3840x2160', 'Refresh rate': '60 Hz', 'Panel': 'IPS (สีแม่นยำ)', 'Ports': 'HDMI, DP, USB-C 65W' },
    tags: ['ตัดต่อ', 'กราฟิก', 'ออกแบบ', 'designer', 'ทำงาน'] },

  // ---- หูฟัง ----
  { id: 301, category: 'Headphone', brand: 'Sonaria', name: 'Sonaria Pods Lite', price: 990, source: 'demo-a',
    specs: { 'Type': 'True Wireless', 'Connection': 'Bluetooth 5.3', 'Battery': '24 ชม. (รวมเคส)', 'Noise cancelling': 'ไม่มี', 'Weight': '45 g' },
    tags: ['ฟังเพลง', 'พกพา', 'ประหยัด', 'ออกกำลังกาย'] },
  { id: 302, category: 'Headphone', brand: 'Sonaria', name: 'Sonaria Quiet ANC 700', price: 4590, source: 'demo-b',
    specs: { 'Type': 'ครอบหู', 'Connection': 'Bluetooth 5.3', 'Battery': '40 ชม.', 'Noise cancelling': 'ANC', 'Weight': '250 g' },
    tags: ['ฟังเพลง', 'ทำงาน', 'เดินทาง', 'ประชุม'] },
  { id: 303, category: 'Headphone', brand: 'Zenqo', name: 'Zenqo Strike 7.1 Gaming Headset', price: 1890, source: 'demo-a',
    specs: { 'Type': 'ครอบหู มีไมค์', 'Connection': 'USB / 3.5 mm', 'Battery': 'ไม่มี (ใช้สาย)', 'Noise cancelling': 'ไมค์ตัดเสียง', 'Weight': '290 g' },
    tags: ['เล่นเกม', 'เกม', 'gaming', 'สตรีม', 'ประชุม'] },

  // ---- ลำโพง ----
  { id: 401, category: 'Speaker', brand: 'Sonaria', name: 'Sonaria Cube Mini', price: 1290, source: 'demo-b',
    specs: { 'Power': '10 W', 'Connection': 'Bluetooth 5.0', 'Battery': '12 ชม.', 'Water resistance': 'IPX5' },
    tags: ['ฟังเพลง', 'พกพา', 'ประหยัด'] },
  { id: 402, category: 'Speaker', brand: 'Zenqo', name: 'Zenqo Desk 2.1', price: 2490, source: 'demo-a',
    specs: { 'Power': '40 W', 'Connection': 'Bluetooth / AUX', 'Battery': 'ไม่มี (ใช้ไฟบ้าน)', 'Water resistance': 'ไม่มี' },
    tags: ['ฟังเพลง', 'ดูหนัง', 'เล่นเกม'] },

  // ---- คีย์บอร์ด ----
  { id: 501, category: 'Keyboard', brand: 'Quillo', name: 'Quillo Type Slim', price: 690, source: 'demo-a',
    specs: { 'Switch': 'Membrane', 'Layout': 'Full size TH/EN', 'Connection': 'Wireless 2.4G', 'Backlight': 'ไม่มี' },
    tags: ['ทำงาน', 'เรียน', 'ประหยัด', 'office'] },
  { id: 502, category: 'Keyboard', brand: 'Quillo', name: 'Quillo Mech 75 Hot-swap', price: 2390, source: 'demo-b',
    specs: { 'Switch': 'Mechanical (สวิตช์เปลี่ยนได้)', 'Layout': '75% TH/EN', 'Connection': 'Bluetooth / 2.4G / USB-C', 'Backlight': 'RGB' },
    tags: ['พิมพ์งาน', 'โปรแกรมมิ่ง', 'programmer', 'เล่นเกม'] },
  { id: 503, category: 'Keyboard', brand: 'Zenqo', name: 'Zenqo Rapid TKL', price: 1590, source: 'demo-a',
    specs: { 'Switch': 'Mechanical (Red)', 'Layout': 'TKL TH/EN', 'Connection': 'USB', 'Backlight': 'RGB' },
    tags: ['เล่นเกม', 'เกม', 'gaming'] },

  // ---- เมาส์ ----
  { id: 601, category: 'Mouse', brand: 'Quillo', name: 'Quillo Glide Silent', price: 390, source: 'demo-b',
    specs: { 'Sensor': '1600 DPI', 'Connection': 'Wireless 2.4G', 'Weight': '75 g', 'Buttons': '3 ปุ่ม (เสียงเงียบ)' },
    tags: ['ทำงาน', 'เรียน', 'ประหยัด', 'พกพา'] },
  { id: 602, category: 'Mouse', brand: 'Zenqo', name: 'Zenqo Viper Air 58', price: 1490, source: 'demo-a',
    specs: { 'Sensor': '26000 DPI', 'Connection': 'Wireless 2.4G / USB-C', 'Weight': '58 g', 'Buttons': '5 ปุ่ม' },
    tags: ['เล่นเกม', 'เกม', 'gaming'] },
  { id: 603, category: 'Mouse', brand: 'Arvenn', name: 'Arvenn Ergo Vertical', price: 990, source: 'demo-b',
    specs: { 'Sensor': '4000 DPI', 'Connection': 'Bluetooth / 2.4G', 'Weight': '120 g', 'Buttons': '6 ปุ่ม' },
    tags: ['ทำงาน', 'ปวดข้อมือ', 'office'] },

  // ---- แผ่นรองเมาส์ ----
  { id: 701, category: 'Mouse Pad', brand: 'Zenqo', name: 'Zenqo Desk Mat XL', price: 450, source: 'demo-a',
    specs: { 'Size': '900 x 400 mm', 'Surface': 'ผ้า Speed', 'Thickness': '4 mm' },
    tags: ['เล่นเกม', 'จัดโต๊ะ'] },

  // ---- เครื่องพิมพ์ ----
  { id: 801, category: 'Printer', brand: 'Pixora', name: 'Pixora InkTank 3-in-1', price: 4290, source: 'demo-b',
    specs: { 'Type': 'อิงค์แท็งก์ (พิมพ์/สแกน/ถ่ายเอกสาร)', 'Color': 'สี', 'Speed': '15 แผ่น/นาที', 'Connection': 'Wi-Fi / USB' },
    tags: ['บ้าน', 'เรียน', 'พิมพ์รูป'] },
  { id: 802, category: 'Printer', brand: 'Arvenn', name: 'Arvenn LaserJet Mono 2000', price: 3590, source: 'demo-a',
    specs: { 'Type': 'เลเซอร์', 'Color': 'ขาวดำ', 'Speed': '30 แผ่น/นาที', 'Connection': 'Wi-Fi / LAN / USB' },
    tags: ['ทำงาน', 'ออฟฟิศ', 'office', 'เอกสาร'] },

  // ---- อุปกรณ์เสริม ----
  { id: 901, category: 'Accessories', brand: 'Velunt', name: 'Velunt USB-C Hub 7-in-1', price: 890, source: 'demo-a',
    specs: { 'Ports': 'HDMI 4K, USB-A x3, SD, microSD, USB-C PD 100W', 'Material': 'อะลูมิเนียม' },
    tags: ['ทำงาน', 'พกพา', 'โน้ตบุ๊ก'] },
  { id: 902, category: 'Accessories', brand: 'Arvenn', name: 'Arvenn Laptop Stand Pro', price: 790, priceMax: 990, source: 'demo-b',
    specs: { 'Material': 'อะลูมิเนียม', 'Adjust': 'ปรับได้ 6 ระดับ', 'Max size': 'โน้ตบุ๊กสูงสุด 17"' },
    tags: ['ทำงาน', 'จัดโต๊ะ', 'สุขภาพ'] },

  // ---- ฮาร์ดแวร์คอมพิวเตอร์ ----
  { id: 1001, category: 'Computer Hardware', brand: 'Kitora', name: 'Kitora NVMe SSD 1TB Gen4', price: 2390, source: 'demo-a',
    specs: { 'Capacity': '1 TB', 'Interface': 'PCIe 4.0 NVMe', 'Read speed': '7000 MB/s', 'Warranty': '5 ปี' },
    tags: ['อัปเกรด', 'เล่นเกม', 'ตัดต่อ'] },
  { id: 1002, category: 'Computer Hardware', brand: 'Novaro', name: 'Novaro DDR5 32GB (2x16) 6000', price: 3490, source: 'demo-b',
    specs: { 'Capacity': '32 GB (2x16)', 'Type': 'DDR5', 'Speed': '6000 MT/s', 'Warranty': 'ตลอดอายุการใช้งาน' },
    tags: ['อัปเกรด', 'เล่นเกม', 'ตัดต่อ'] }
];

/** เมนูหมวดหมู่ (โครงเดียวกับ category_menu ของระบบจริง: ราก "อุปกรณ์ทั้งหมด" -> หมวดย่อย) */
const MENU: { name: string; icon: string; slug: string; key: string }[] = [
  { name: 'อุปกรณ์เสริม', icon: 'cable', slug: 'accessories', key: 'Accessories' },
  { name: 'ฮาร์ดแวร์คอมพิวเตอร์', icon: 'memory', slug: 'computer-hardware', key: 'Computer Hardware' },
  { name: 'หูฟัง', icon: 'headphones', slug: 'headphone', key: 'Headphone' },
  { name: 'คีย์บอร์ด', icon: 'keyboard', slug: 'keyboard', key: 'Keyboard' },
  { name: 'จอมอนิเตอร์', icon: 'monitor', slug: 'monitor', key: 'Monitor' },
  { name: 'เมาส์', icon: 'mouse', slug: 'mouse', key: 'Mouse' },
  { name: 'แผ่นรองเมาส์', icon: 'rectangle', slug: 'mouse-pad', key: 'Mouse Pad' },
  { name: 'โน้ตบุ๊ก', icon: 'laptop_chromebook', slug: 'notebook', key: 'Notebook' },
  { name: 'ปริ้นเตอร์', icon: 'print', slug: 'printer', key: 'Printer' },
  { name: 'ลำโพง', icon: 'speaker', slug: 'speaker', key: 'Speaker' }
];

export function demoCategoryTree(): Category[] {
  const children: Category[] = MENU
    .map(m => ({
      name: m.name, icon: m.icon, slug: m.slug, categoryKey: m.key,
      count: DEMO_PRODUCTS.filter(p => p.category === m.key).length, children: []
    }))
    .filter(c => (c.count ?? 0) > 0);
  const total = children.reduce((sum, c) => sum + (c.count ?? 0), 0);
  return [{ name: 'อุปกรณ์ทั้งหมด', icon: 'grid_view', slug: null, categoryKey: undefined, count: total, children }];
}

/** ข้อความสเปกรวมบรรทัดเดียว (แบบที่ระบบจริงส่งมาใน specification) */
export function specText(p: DemoProduct): string {
  return Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(' / ');
}

export function toProduct(p: DemoProduct): Product {
  return {
    id: p.id,
    category: p.category,
    brand: p.brand,
    productName: p.name,
    specification: specText(p),
    priceMin: p.price,
    priceMax: p.priceMax ?? p.price,
    url: '',
    image: '',
    source: p.source,
    priceAsOf: DEMO_PRICE_AS_OF
  };
}

export function findDemoProduct(id: number): DemoProduct | undefined {
  return DEMO_PRODUCTS.find(p => p.id === id);
}
