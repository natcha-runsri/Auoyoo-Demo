import {
  addDays, addMonths, calendarWeeks, formatMonthTitle, formatThaiFullDate, formatThaiRange, isValidIsoDate, todayInBangkok
} from './history-dates';
import { MIN_SAMPLES, NOT_ENOUGH_DATA, categoryColors, categoryInsight, chartAriaLabel, priceInsight } from './history-insights';
import { HistorySummary, Slice } from '../../services/history/history.service';

const slice = (key: string, label: string, count: number, percent: number): Slice => ({ key, label, count, percent });

function summary(categories: Slice[], priceRanges: Slice[] = []): HistorySummary {
  return {
    from: '2026-08-05', to: '2026-08-11', rangeDays: 7,
    categoryTotal: categories.reduce((n, s) => n + s.count, 0), categories,
    priceTotal: priceRanges.reduce((n, s) => n + s.count, 0), priceRanges
  };
}

describe('history-dates', () => {
  it('วันที่ไทยเต็ม ปี พ.ศ.', () => {
    expect(formatThaiFullDate('2026-08-11')).toBe('วันอังคารที่ 11 สิงหาคม 2569');
    expect(formatThaiFullDate('2026-01-01')).toBe('วันพฤหัสบดีที่ 1 มกราคม 2569');
  });

  it('วันนี้ตามเวลาไทย (ไม่ใช่เวลาเครื่อง)', () => {
    // 17:30 UTC = 00:30 วันถัดไปเวลาไทย
    expect(todayInBangkok(new Date('2026-08-10T17:30:00Z'))).toBe('2026-08-11');
    expect(todayInBangkok(new Date('2026-08-10T16:59:00Z'))).toBe('2026-08-10');
  });

  it('บวก/ลบวันข้ามเดือน/ปี และตรวจรูปแบบวันที่', () => {
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(isValidIsoDate('2026-08-11')).toBeTrue();
    expect(isValidIsoDate('2026-02-30')).toBeFalse();
    expect(isValidIsoDate('11/08/2026')).toBeFalse();
    expect(isValidIsoDate(null)).toBeFalse();
  });

  it('ช่วงวันแบบสั้น', () => {
    expect(formatThaiRange('2026-08-05', '2026-08-11')).toBe('5 – 11 ส.ค. 2569');
    expect(formatThaiRange('2026-07-13', '2026-08-11')).toBe('13 ก.ค. – 11 ส.ค. 2569');
    expect(formatThaiRange('2025-12-26', '2026-01-01')).toBe('26 ธ.ค. 2568 – 1 ม.ค. 2569');
  });

  it('ปฏิทินเริ่มวันจันทร์ หัวปฏิทินใช้ปี ค.ศ.', () => {
    const weeks = calendarWeeks('2026-08'); // 1 ส.ค. 2569 = วันเสาร์
    expect(weeks[0].map(c => c.day)).toEqual([null, null, null, null, null, 1, 2]);
    expect(weeks.flat().filter(c => c.date).length).toBe(31);
    expect(weeks.every(w => w.length === 7)).toBeTrue();
    expect(formatMonthTitle('2026-08')).toBe('สิงหาคม 2569');
  });
});

describe('history-insights', () => {
  it('ข้อมูลน้อยกว่าเกณฑ์ -> ไม่สรุป และอ่านกราฟว่าข้อมูลไม่พอ', () => {
    const s = summary([slice('Notebook', 'โน้ตบุ๊ค', MIN_SAMPLES - 1, 100)]);
    expect(categoryInsight(s)).toBe('');
    expect(categoryInsight(null)).toBe('');
    expect(chartAriaLabel('หมวดหมู่ที่สนใจ', s.categories, false)).toBe(`หมวดหมู่ที่สนใจ: ${NOT_ENOUGH_DATA}`);
  });

  it('สรุปหมวดอันดับ 1–3 ตามเปอร์เซ็นต์จาก backend', () => {
    const s = summary([slice('Notebook', 'โน้ตบุ๊ค', 9, 45), slice('Headphone', 'หูฟัง', 6, 30), slice('Mouse', 'เมาส์', 5, 25)]);
    expect(categoryInsight(s)).toBe('จากข้อมูลการใช้งาน คุณให้ความสนใจ โน้ตบุ๊ค มากที่สุด คิดเป็น 45% ของการค้นหาและเข้าชมทั้งหมด'
      + ' รองลงมาคือ หูฟัง 30% และ เมาส์ 25%');
    expect(chartAriaLabel('หมวดหมู่ที่สนใจ', s.categories, true)).toBe('หมวดหมู่ที่สนใจ: โน้ตบุ๊ค 45%, หูฟัง 30%, เมาส์ 25%');
  });

  it('อันดับ 1 เท่ากัน / มีหมวดเดียว / "อื่น ๆ" ไม่ถูกนับเป็นหมวดที่สนใจ', () => {
    expect(categoryInsight(summary([slice('A', 'เมาส์', 2, 50), slice('B', 'หูฟัง', 2, 50)])))
      .toBe('จากข้อมูลการใช้งาน คุณให้ความสนใจ เมาส์ และ หูฟัง พอ ๆ กัน (อย่างละ 50%)');
    expect(categoryInsight(summary([slice('A', 'เมาส์', 4, 100)])))
      .toBe('จากข้อมูลการใช้งาน การค้นหาและเข้าชมทั้งหมดของคุณอยู่ในหมวด เมาส์');
    const withOther = [slice('A', 'เมาส์', 3, 60), slice('OTHER', 'อื่น ๆ', 2, 40)];
    expect(categoryInsight(summary(withOther))).toContain('การค้นหาและเข้าชมทั้งหมดของคุณอยู่ในหมวด เมาส์');
    expect(categoryColors(withOther)).toEqual(['#f07b3f', '#c9ced8']);
  });

  it('สรุปช่วงราคา: ช่วงที่มากที่สุดก่อน แม้ backend เรียงจากถูกไปแพง', () => {
    const s = summary([], [slice('UNDER_10K', 'ต่ำกว่า 10,000', 1, 25), slice('20K_40K', '20,000–40,000', 2, 50),
      slice('OVER_40K', 'มากกว่า 40,000', 1, 25)]);
    expect(priceInsight(s)).toBe('ด้านงบประมาณ คุณมักดูสินค้าในช่วง 20,000–40,000 บาท คิดเป็น 50% ของรายการที่มีราคา'
      + ' รองลงมาคือช่วง ต่ำกว่า 10,000 บาท 25%');
    expect(priceInsight(summary([], [slice('10K_20K', '10,000–20,000', 3, 100)])))
      .toBe('ด้านงบประมาณ สินค้าและงบที่คุณสนใจทั้งหมดอยู่ในช่วง 10,000–20,000 บาท');
  });
});
