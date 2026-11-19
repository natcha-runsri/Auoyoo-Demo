/**
 * วันที่ของหน้า /history เก็บเป็นข้อความ "yyyy-MM-dd" ตลอด (ไม่ส่ง Date ไปมา) และ "วันนี้" ยึดเวลาไทยเสมอ
 * คำนวณบวก/ลบวันผ่าน Date แบบ UTC ล้วน ไม่มีปัญหาวันเลื่อนตาม timezone ของเครื่องผู้ใช้
 */

export const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const THAI_SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** หัวคอลัมน์ปฏิทิน เริ่มวันจันทร์ */
export const WEEKDAY_HEADERS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** วันนี้ตามเวลาไทย */
export function todayInBangkok(now: Date = new Date()): string {
  // en-CA ให้รูปแบบ yyyy-MM-dd
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  const m = ISO_DATE.exec(value ?? '');
  if (!m) return false;
  const d = toUtc(value as string);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** "2026-08-11" -> "วันอังคารที่ 11 สิงหาคม 2569" */
export function formatThaiFullDate(iso: string): string {
  const d = toUtc(iso);
  return `วัน${THAI_DAYS[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

/** ช่วงวันแบบสั้น: "5 – 11 ส.ค. 2569" / "13 ก.ค. – 11 ส.ค. 2569" / ข้ามปีแสดงปีทั้งสองฝั่ง */
export function formatThaiRange(fromIso: string, toIso: string): string {
  const a = toUtc(fromIso);
  const b = toUtc(toIso);
  const yearA = a.getUTCFullYear() + 543;
  const yearB = b.getUTCFullYear() + 543;
  const monthA = THAI_SHORT_MONTHS[a.getUTCMonth()];
  const monthB = THAI_SHORT_MONTHS[b.getUTCMonth()];
  if (yearA !== yearB) return `${a.getUTCDate()} ${monthA} ${yearA} – ${b.getUTCDate()} ${monthB} ${yearB}`;
  if (monthA !== monthB) return `${a.getUTCDate()} ${monthA} – ${b.getUTCDate()} ${monthB} ${yearB}`;
  return `${a.getUTCDate()} – ${b.getUTCDate()} ${monthB} ${yearB}`;
}

/** "2026-08" ของวันที่นั้น */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return fromUtc(d).slice(0, 7);
}

export interface CalendarCell {
  /** null = ช่องว่างก่อนวันที่ 1 */
  date: string | null;
  day: number | null;
}

/** ช่องของปฏิทินเดือนนั้น เริ่มวันจันทร์ (ช่องว่างข้างหน้าเป็น null) แบ่งเป็นแถวละ 7 */
export function calendarWeeks(month: string): CalendarCell[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // จันทร์ = 0
  const cells: CalendarCell[] = Array.from({ length: leading }, () => ({ date: null, day: null }));
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: `${month}-${String(day).padStart(2, '0')}`, day });
  }
  while (cells.length % 7) cells.push({ date: null, day: null });
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "สิงหาคม 2569" — ปี พ.ศ. เหมือนวันที่อื่นในหน้า */
export function formatMonthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}
