import { CompareAnalysis, CompareRow, CompareTable } from '../models/compare';
import { RecommendationCriteria, RecommendationResponse } from '../services/recommend/recommend.service';
import { categoryLabel } from '../config/category-labels';
import { storeDisplayName } from '../config/stores';
import { DEMO_PRICE_AS_OF, DEMO_PRODUCTS, DemoProduct, toProduct } from './demo-data';

/**
 * "AI" ของเดโม — ไม่ใช้โมเดลภาษาใด ๆ: อ่านคำสำคัญ (หมวด งบ แบรนด์ การใช้งาน) จากข้อความ
 * แล้วเลือกสินค้าจำลองตามกฎตายตัว และประกอบข้อความจากแม่แบบ
 */
export const DEMO_AI_NOTE = '(เดโม: คำตอบนี้สร้างจากคำสำคัญในข้อความ ไม่ได้ใช้โมเดลภาษา)';

const CATEGORY_WORDS: [string, string[]][] = [
  // คำยาวก่อน — "แผ่นรองเมาส์" ต้องไม่ถูกจับเป็น "เมาส์"
  ['Mouse Pad', ['แผ่นรองเมาส์', 'mouse pad', 'mousepad', 'แผ่นรอง']],
  ['Notebook', ['โน้ตบุ๊ก', 'โน้ตบุ๊ค', 'โน๊ตบุ๊ก', 'โน๊ตบุ๊ค', 'notebook', 'laptop', 'แล็ปท็อป', 'แลปท็อป']],
  ['Monitor', ['จอมอนิเตอร์', 'มอนิเตอร์', 'monitor', 'จอ']],
  ['Headphone', ['หูฟัง', 'headphone', 'headset', 'earbud', 'แอร์พอด']],
  ['Speaker', ['ลำโพง', 'speaker']],
  ['Keyboard', ['คีย์บอร์ด', 'keyboard', 'แป้นพิมพ์']],
  ['Mouse', ['เมาส์', 'mouse']],
  ['Printer', ['ปริ้นเตอร์', 'ปรินเตอร์', 'เครื่องพิมพ์', 'printer']],
  ['Accessories', ['อุปกรณ์เสริม', 'ฮับ', 'hub', 'ขาตั้ง', 'stand']],
  ['Computer Hardware', ['ฮาร์ดแวร์', 'ssd', 'แรม', 'ram', 'อัปเกรด', 'อัพเกรด']]
];

const FEATURE_WORDS: [string, string[]][] = [
  ['เล่นเกม', ['เกม', 'game', 'gaming', 'เล่นเกม']],
  ['ทำงาน', ['ทำงาน', 'office', 'ออฟฟิศ', 'งานเอกสาร', 'work']],
  ['เรียน', ['เรียน', 'นักเรียน', 'นักศึกษา', 'student']],
  ['พกพา', ['พกพา', 'เบา', 'เดินทาง', 'travel']],
  ['ตัดต่อ', ['ตัดต่อ', 'กราฟิก', 'ออกแบบ', 'design', 'video']],
  ['โปรแกรมมิ่ง', ['โปรแกรม', 'เขียนโค้ด', 'coding', 'programmer', 'dev']],
  ['ฟังเพลง', ['เพลง', 'music']],
  ['ประหยัด', ['ประหยัด', 'ถูก', 'คุ้ม', 'cheap']]
];

const BRANDS = Array.from(new Set(DEMO_PRODUCTS.map(p => p.brand)));

/** คำภาษาอังกฤษต้องตรงทั้งคำ ("ram" ไม่ไปตรงกับ "program") ส่วนคำไทยไม่มีช่องว่างคั่นจึงใช้ includes */
function hasWord(text: string, word: string): boolean {
  return /^[a-z0-9 ]+$/.test(word) ? new RegExp(`\\b${word}\\b`).test(text) : text.includes(word);
}

interface Parsed {
  category: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  brand: string | null;
  unknownBrand: string | null;
  features: string[];
}

export function parseMessage(message: string, context: RecommendationCriteria | null): Parsed {
  const text = message.toLowerCase();
  const category = CATEGORY_WORDS.find(([, words]) => words.some(w => hasWord(text, w)))?.[0] ?? null;
  const brand = BRANDS.find(b => hasWord(text, b.toLowerCase())) ?? null;
  // "แบรนด์ X" / "ยี่ห้อ X" ที่ไม่มีในข้อมูลเดโม -> แจ้งผู้ใช้
  const brandWord = /(?:แบรนด์|ยี่ห้อ|brand)\s*([a-z0-9-]+)/i.exec(message)?.[1] ?? null;
  const unknownBrand = !brand && brandWord ? brandWord : null;
  const features = FEATURE_WORDS.filter(([, words]) => words.some(w => hasWord(text, w))).map(([f]) => f);
  const { min, max } = parseBudget(text);

  // ข้อความต่อเนื่อง ("ถูกกว่านี้", "งบ 15000") ใช้หมวด/แบรนด์จากคำตอบก่อนหน้า
  const sameTopic = !category && !!context?.category;
  let maxPrice = max ?? (sameTopic ? context?.maxPrice ?? null : null);
  if (sameTopic && max == null && /ถูกกว่า|ถูกลง|ราคาต่ำกว่านี้|cheaper/.test(text) && maxPrice) {
    maxPrice = Math.round(maxPrice * 0.75);
  }
  return {
    category: category ?? (sameTopic ? context!.category : null),
    minPrice: min ?? (sameTopic ? context?.minPrice ?? null : null),
    maxPrice,
    brand: brand ?? (sameTopic ? context?.brand ?? null : null),
    unknownBrand,
    features: features.length ? features : (sameTopic ? context?.features ?? [] : [])
  };
}

/** งบประมาณ: "งบ 20000", "ไม่เกิน 2 หมื่น", "20k", "15,000-25,000", "ตั้งแต่ 5000" — ไม่นับตัวเลขสเปก (16GB, 27 นิ้ว) */
export function parseBudget(text: string): { min: number | null; max: number | null } {
  const values: { value: number; index: number }[] = [];
  const re = /(\d+(?:[.,]\d+)*)\s*(k|พัน|หมื่น|แสน)?(\s*(?:gb|tb|hz|นิ้ว|"|w\b|mm|dpi|ชม|คอร์))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[3]) continue; // ตัวเลขสเปก
    let value = parseFloat(m[1].replace(/,/g, ''));
    const unit = (m[2] ?? '').toLowerCase();
    if (unit === 'k' || unit === 'พัน') value *= 1000;
    if (unit === 'หมื่น') value *= 10000;
    if (unit === 'แสน') value *= 100000;
    if (value >= 100) values.push({ value, index: m.index });
  }
  if (!values.length) return { min: null, max: null };
  if (values.length >= 2) {
    const [a, b] = [values[0].value, values[1].value].sort((x, y) => x - y);
    return { min: a, max: b };
  }
  const before = text.slice(0, values[0].index);
  if (/(ตั้งแต่|มากกว่า|เกิน|อย่างน้อย|ขึ้นไป|over|above)\s*$/.test(before) || /ขึ้นไป/.test(text.slice(values[0].index))) {
    return { min: values[0].value, max: null };
  }
  return { min: null, max: values[0].value };
}

function featureScore(p: DemoProduct, features: string[]): number {
  return features.filter(f => p.tags.includes(f) || (f === 'เล่นเกม' && p.tags.includes('เกม'))).length;
}

/** แท็กการใช้งานที่แสดงให้ผู้ใช้เห็น: ภาษาไทยเท่านั้น ไม่ซ้ำความหมาย ("เกม" ซ้ำกับ "เล่นเกม") */
function usageTags(p: DemoProduct, max = 3): string {
  const thai = p.tags.filter(t => /[฀-๿]/.test(t) && !(t === 'เกม' && p.tags.includes('เล่นเกม')));
  return thai.slice(0, max).join(', ');
}

function baht(n: number): string {
  return `฿${n.toLocaleString('th-TH')}`;
}

function highlight(p: DemoProduct): string {
  return Object.entries(p.specs).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ');
}

function criteriaOf(parsed: Parsed): RecommendationCriteria {
  return {
    category: parsed.category, minPrice: parsed.minPrice, maxPrice: parsed.maxPrice, brand: parsed.brand,
    persona: null, features: parsed.features
  };
}

export function recommend(message: string, context: RecommendationCriteria | null): RecommendationResponse {
  const parsed = parseMessage(message, context);
  if (!parsed.category && !parsed.features.length && !parsed.brand) {
    return {
      understood: false, reason: 'NO_CATEGORY', narration: null, products: [], criteria: null,
      message: 'ยังไม่แน่ใจว่าต้องการสินค้าประเภทไหน ลองพิมพ์ เช่น "โน้ตบุ๊กเล่นเกม งบ 30000" หรือ "หูฟังตัดเสียงรบกวน ไม่เกิน 5000"\n'
        + 'หมวดในเดโม: โน้ตบุ๊ก จอ หูฟัง ลำโพง คีย์บอร์ด เมาส์ แผ่นรองเมาส์ ปริ้นเตอร์ อุปกรณ์เสริม ฮาร์ดแวร์'
    };
  }

  const inScope = DEMO_PRODUCTS.filter(p =>
    (!parsed.category || p.category === parsed.category) && (!parsed.brand || p.brand === parsed.brand));
  const inBudget = inScope.filter(p =>
    (parsed.minPrice == null || p.price >= parsed.minPrice) && (parsed.maxPrice == null || p.price <= parsed.maxPrice));

  const notes: string[] = [];
  if (parsed.unknownBrand) {
    notes.push(`ไม่พบแบรนด์ "${parsed.unknownBrand}" ในข้อมูลเดโม จึงแนะนำจากทุกแบรนด์แทน`);
  }
  let pool = inBudget;
  if (!pool.length) {
    pool = [...inScope].sort((a, b) => a.price - b.price).slice(0, 3);
    if (parsed.maxPrice != null) {
      notes.push(`ไม่มีรุ่นที่ราคาไม่เกิน ${baht(parsed.maxPrice)} ในข้อมูลเดโม — นี่คือรุ่นที่ราคาใกล้เคียงที่สุด`);
    }
  }
  const ranked = [...pool].sort((a, b) =>
    featureScore(b, parsed.features) - featureScore(a, parsed.features)
    // มีงบ: เลือกรุ่นที่ใช้งบได้เต็มที่ก่อน, ไม่มีงบ: ถูกก่อน
    || (parsed.maxPrice != null ? b.price - a.price : a.price - b.price));
  const picks = ranked.slice(0, 4);

  const what = parsed.category ? categoryLabel(parsed.category) : 'สินค้า';
  const conditions = [
    parsed.features.length ? `สำหรับ${parsed.features.join(' / ')}` : '',
    parsed.brand ? `แบรนด์ ${parsed.brand}` : '',
    parsed.minPrice != null ? `ตั้งแต่ ${baht(parsed.minPrice)}` : '',
    parsed.maxPrice != null ? `ไม่เกิน ${baht(parsed.maxPrice)}` : ''
  ].filter(Boolean).join(' ');
  const lines = picks.map((p, i) => `${i + 1}) ${p.name} — ${baht(p.price)} (${highlight(p)})`);
  const narration = [
    `แนะนำ${what}${conditions ? ' ' + conditions : ''} ${picks.length} รุ่น:`,
    ...lines,
    picks.length > 1 ? `ถ้าเน้นความคุ้มค่า ลองดู ${[...picks].sort((a, b) => a.price - b.price)[0].name} ก่อน` : '',
    DEMO_AI_NOTE
  ].filter(Boolean).join('\n');

  return {
    understood: true, reason: null,
    message: notes.length ? notes.join('\n') : null,
    narration,
    products: picks.map(toProduct),
    criteria: criteriaOf(parsed)
  };
}

/** แนะนำอัตโนมัติ: หมวดที่ผู้ใช้ดูบ่อย (ถ้ามีประวัติ) ไม่มีก็รุ่นคุ้มค่าจากหลายหมวด */
export function autoRecommend(recentCategories: string[]): RecommendationResponse {
  const top = mostCommon(recentCategories);
  const picks = top
    ? DEMO_PRODUCTS.filter(p => p.category === top).sort((a, b) => a.price - b.price).slice(0, 4)
    : [101, 202, 302, 502].map(id => DEMO_PRODUCTS.find(p => p.id === id)!);
  const intro = top
    ? `จากประวัติการดูสินค้า คุณสนใจ${categoryLabel(top)} — นี่คือรุ่นที่น่าสนใจ:`
    : 'รุ่นคุ้มค่าที่น่าสนใจจากหลายหมวดในเดโม:';
  const narration = [intro, ...picks.map((p, i) => `${i + 1}) ${p.name} — ${baht(p.price)}`), DEMO_AI_NOTE].join('\n');
  return { understood: true, reason: null, message: null, narration, products: picks.map(toProduct), criteria: null };
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  for (const [k, c] of counts) if (best == null || c > counts.get(best)!) best = k;
  return best;
}

// ---------- ตารางเปรียบเทียบ / ผลวิเคราะห์ ----------

const SPEC_LABELS: Record<string, string> = {
  'CPU': 'ซีพียู', 'RAM': 'แรม', 'Storage': 'พื้นที่เก็บข้อมูล', 'Display': 'หน้าจอ', 'GPU': 'การ์ดจอ',
  'Weight': 'น้ำหนัก', 'Battery': 'แบตเตอรี่', 'Size': 'ขนาด', 'Resolution': 'ความละเอียด', 'Refresh rate': 'รีเฟรชเรต',
  'Panel': 'พาเนล', 'Ports': 'พอร์ต', 'Type': 'ประเภท', 'Connection': 'การเชื่อมต่อ', 'Noise cancelling': 'ตัดเสียงรบกวน',
  'Power': 'กำลังขับ', 'Water resistance': 'กันน้ำ', 'Switch': 'สวิตช์', 'Layout': 'เลย์เอาต์', 'Backlight': 'ไฟคีย์บอร์ด',
  'Sensor': 'เซนเซอร์', 'Buttons': 'ปุ่ม', 'Surface': 'พื้นผิว', 'Thickness': 'ความหนา', 'Color': 'สี', 'Speed': 'ความเร็ว',
  'Material': 'วัสดุ', 'Adjust': 'การปรับระดับ', 'Max size': 'รองรับขนาด', 'Capacity': 'ความจุ', 'Interface': 'อินเทอร์เฟซ',
  'Read speed': 'ความเร็วอ่าน', 'Warranty': 'ประกัน'
};
/** หัวข้อที่ค่ามาก = ดี */
const HIGHER_BETTER = new Set(['RAM', 'Storage', 'Refresh rate', 'Battery', 'Sensor', 'Power', 'Speed', 'Read speed',
  'Capacity', 'Resolution', 'GPU', 'Size']);
/** หัวข้อที่ค่าน้อย = ดี */
const LOWER_BETTER = new Set(['Weight']);

/** ค่าตัวเลขของสเปก (TB -> GB, ความละเอียด = กว้างxสูง) — ไม่มีตัวเลข = null */
export function specNumber(key: string, value: string | undefined): number | null {
  if (!value) return null;
  if (key === 'Resolution') {
    const [w, h] = value.split('x').map(Number);
    return w && h ? w * h : null;
  }
  const m = /(\d+(?:\.\d+)?)/.exec(value);
  if (!m) return key === 'GPU' ? 0 : null;
  let n = parseFloat(m[1]);
  if (/tb/i.test(value)) n *= 1000;
  return n;
}

function bestIndexes(key: string, values: (string | null)[]): number[] {
  if (!HIGHER_BETTER.has(key) && !LOWER_BETTER.has(key)) return [];
  const nums = values.map(v => specNumber(key, v ?? undefined));
  const valid = nums.filter((n): n is number => n != null);
  if (valid.length < 2) return [];
  const target = HIGHER_BETTER.has(key) ? Math.max(...valid) : Math.min(...valid);
  if (valid.every(n => n === target)) return [];
  return nums.flatMap((n, i) => (n === target ? [i] : []));
}

export function compareTable(items: DemoProduct[]): CompareTable {
  const prices = items.map(p => p.price);
  const minPrice = Math.min(...prices);
  const basic: CompareRow[] = [
    { key: 'price', label: 'ราคา', group: 'basic', values: items.map(p => baht(p.price)),
      best: items.length > 1 && prices.some(x => x !== minPrice) ? items.flatMap((p, i) => (p.price === minPrice ? [i] : [])) : [] },
    { key: 'brand', label: 'แบรนด์', group: 'basic', values: items.map(p => p.brand), best: [] },
    { key: 'category', label: 'หมวด', group: 'basic', values: items.map(p => categoryLabel(p.category)), best: [] },
    { key: 'store', label: 'ร้าน', group: 'basic', values: items.map(p => storeDisplayName(p.source)), best: [] }
  ];
  const keys: string[] = [];
  for (const p of items) for (const k of Object.keys(p.specs)) if (!keys.includes(k)) keys.push(k);
  const spec: CompareRow[] = keys.map(k => {
    const values = items.map(p => p.specs[k] ?? null);
    return { key: k, label: SPEC_LABELS[k] ?? k, group: 'spec', values, best: bestIndexes(k, values) };
  });
  return {
    products: items.map(p => ({
      product: toProduct(p), categoryLabel: categoryLabel(p.category), categoryKey: p.category,
      kind: p.category.toLowerCase(), kindLabel: categoryLabel(p.category)
    })),
    rows: [...basic, ...spec],
    sameKind: new Set(items.map(p => p.category)).size === 1,
    cheapestIds: items.filter(p => p.price === minPrice).map(p => p.id)
  };
}

/** คะแนนสเปกเทียบกันภายในชุด (0..1 ต่อหัวข้อ เฉลี่ยรวม) */
function specScores(items: DemoProduct[]): Map<number, number> {
  const scores = new Map<number, number>(items.map(p => [p.id, 0]));
  const keys = new Set(items.flatMap(p => Object.keys(p.specs)));
  let counted = 0;
  for (const k of keys) {
    if (!HIGHER_BETTER.has(k) && !LOWER_BETTER.has(k)) continue;
    const nums = items.map(p => specNumber(k, p.specs[k]));
    const valid = nums.filter((n): n is number => n != null && n > 0);
    if (valid.length < 2) continue;
    const max = Math.max(...valid);
    const min = Math.min(...valid);
    counted++;
    items.forEach((p, i) => {
      const n = nums[i];
      if (n == null || n <= 0) return;
      const s = HIGHER_BETTER.has(k) ? n / max : min / n;
      scores.set(p.id, scores.get(p.id)! + s);
    });
  }
  if (counted) for (const [id, s] of scores) scores.set(id, s / counted);
  return scores;
}

export function compareAnalysis(items: DemoProduct[], cached: boolean): CompareAnalysis {
  const sameKind = new Set(items.map(p => p.category)).size === 1;
  const scores = specScores(items);
  const cheapest = [...items].sort((a, b) => a.price - b.price)[0];
  const priciest = [...items].sort((a, b) => b.price - a.price)[0];
  const topSpec = [...items].sort((a, b) => scores.get(b.id)! - scores.get(a.id)!)[0];
  const bestValue = [...items].sort((a, b) =>
    (scores.get(b.id)! + 0.01) / b.price - (scores.get(a.id)! + 0.01) / a.price)[0];

  const products = items.map(p => {
    const strengths: string[] = [];
    const caveats: string[] = [];
    if (p.id === cheapest.id) strengths.push(`ราคาถูกที่สุดในชุดนี้ (${baht(p.price)})`);
    if (p.id === priciest.id && items.length > 1) caveats.push('ราคาสูงที่สุดในชุดนี้');
    for (const [k, v] of Object.entries(p.specs)) {
      const best = bestIndexes(k, items.map(x => x.specs[k] ?? null));
      if (best.length === 1 && items[best[0]].id === p.id) {
        strengths.push(`${SPEC_LABELS[k] ?? k}ดีที่สุดในชุด (${v})`);
      }
      if (LOWER_BETTER.has(k)) {
        const heaviest = Math.max(...items.map(x => specNumber(k, x.specs[k]) ?? 0));
        if (items.length > 1 && specNumber(k, v) === heaviest) caveats.push(`${SPEC_LABELS[k] ?? k}มากที่สุด (${v})`);
      }
    }
    if (!strengths.length) strengths.push(`สเปกสมดุล: ${highlight(p)}`);
    if (!caveats.length) caveats.push('ไม่มีจุดด้อยเด่นชัดเมื่อเทียบกับรุ่นอื่นในชุดนี้');
    return { id: p.id, strengths: strengths.slice(0, 3), caveats: caveats.slice(0, 2), suitedFor: usageTags(p) };
  });

  const scenarios = [
    { condition: 'ถ้างบจำกัด', productId: cheapest.id },
    { condition: 'ถ้าต้องการสเปกสูงสุด', productId: topSpec.id }
  ];
  const gamer = items.find(p => p.tags.includes('เล่นเกม'));
  if (gamer) scenarios.push({ condition: 'ถ้าเน้นเล่นเกม', productId: gamer.id });
  const portable = items.find(p => p.tags.includes('พกพา'));
  if (portable) scenarios.push({ condition: 'ถ้าต้องพกพาบ่อย', productId: portable.id });

  const low = cheapest.price;
  const high = priciest.price;
  return {
    sameKind,
    overview: `เปรียบเทียบ ${items.length} รุ่น ราคา ${baht(low)}${high !== low ? `–${baht(high)}` : ''} `
      + (sameKind ? `(${categoryLabel(items[0].category)} ทั้งหมด)` : '(ต่างประเภทกัน เทียบสเปกตรง ๆ ได้บางหัวข้อ)')
      + ` ${DEMO_AI_NOTE}`,
    products,
    recommendation: { id: bestValue.id, reason: `${bestValue.name} ให้สเปกต่อราคาคุ้มที่สุดในชุดนี้ (${baht(bestValue.price)})` },
    scenarios,
    bestValueId: bestValue.id,
    topSpecId: topSpec.id,
    analyzedAt: new Date().toISOString(),
    dataAsOf: DEMO_PRICE_AS_OF,
    cached
  };
}

export function compareAnswer(items: DemoProduct[], question: string): string {
  const q = question.toLowerCase();
  const byPrice = [...items].sort((a, b) => a.price - b.price);
  const num = (p: DemoProduct, k: string) => specNumber(k, p.specs[k]) ?? -1;
  let answer: string;
  if (/เกม|game|gaming/.test(q)) {
    const pick = [...items].sort((a, b) => featureScore(b, ['เล่นเกม']) - featureScore(a, ['เล่นเกม'])
      || num(b, 'Refresh rate') - num(a, 'Refresh rate') || num(b, 'GPU') - num(a, 'GPU'))[0];
    answer = `ถ้าเน้นเล่นเกม แนะนำ ${pick.name} (${highlight(pick)})`;
  } else if (/พกพา|เบา|น้ำหนัก|weight|travel/.test(q)) {
    const withWeight = items.filter(p => p.specs['Weight']);
    const pick = withWeight.sort((a, b) => num(a, 'Weight') - num(b, 'Weight'))[0];
    answer = pick ? `รุ่นที่เบาที่สุดคือ ${pick.name} (${pick.specs['Weight']})` : 'สินค้าชุดนี้ไม่มีข้อมูลน้ำหนักให้เทียบ';
  } else if (/แบต|battery/.test(q)) {
    const pick = [...items].sort((a, b) => num(b, 'Battery') - num(a, 'Battery'))[0];
    answer = pick.specs['Battery'] ? `แบตเตอรี่อยู่ได้นานที่สุดคือ ${pick.name} (${pick.specs['Battery']})` : 'สินค้าชุดนี้ไม่มีข้อมูลแบตเตอรี่ให้เทียบ';
  } else if (/ราคา|ถูก|คุ้ม|งบ|price|cheap/.test(q)) {
    answer = `เรียงจากราคาถูกไปแพง: ${byPrice.map(p => `${p.name} ${baht(p.price)}`).join(', ')}\n`
      + `ส่วนต่างราคา ${baht(byPrice[byPrice.length - 1].price - byPrice[0].price)}`;
  } else if (/ทำงาน|เรียน|office|work|study/.test(q)) {
    const pick = [...items].sort((a, b) => featureScore(b, ['ทำงาน', 'เรียน']) - featureScore(a, ['ทำงาน', 'เรียน']) || a.price - b.price)[0];
    answer = `สำหรับทำงาน/เรียน ${pick.name} เหมาะสุดในชุดนี้ (${baht(pick.price)})`;
  } else {
    answer = `สรุปสั้น ๆ: ${items.map(p => `${p.name} (${baht(p.price)}) เหมาะกับ${usageTags(p, 2).replace(', ', '/')}`).join('; ')}\n`
      + 'ลองถามเรื่อง ราคา เล่นเกม พกพา แบตเตอรี่ หรือ ทำงาน';
  }
  return `${answer}\n${DEMO_AI_NOTE}`;
}
