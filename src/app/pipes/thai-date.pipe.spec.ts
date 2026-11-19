import { ThaiDatePipe, formatThaiDate } from './thai-date.pipe';

describe('formatThaiDate / ThaiDatePipe', () => {
  it('แปลงเป็นวัน เดือนย่อ ปี พ.ศ.', () => {
    expect(formatThaiDate('2026-08-20')).toBe('20 ส.ค. 2569');
    expect(formatThaiDate('2026-01-05')).toBe('5 ม.ค. 2569');
    expect(formatThaiDate('2025-12-31')).toBe('31 ธ.ค. 2568');
  });

  it('รับรูปแบบมีเวลาต่อท้ายได้ และไม่เลื่อนวันตาม timezone', () => {
    expect(formatThaiDate('2026-08-20T23:59:59')).toBe('20 ส.ค. 2569');
  });

  it('ค่าว่าง/ผิดรูปแบบ -> ข้อความว่าง', () => {
    expect(formatThaiDate(null)).toBe('');
    expect(formatThaiDate('')).toBe('');
    expect(formatThaiDate('20/08/2026')).toBe('');
    expect(formatThaiDate('2026-13-01')).toBe('');
  });

  it('pipe ใช้ฟังก์ชันเดียวกัน', () => {
    expect(new ThaiDatePipe().transform('2026-08-20')).toBe('20 ส.ค. 2569');
  });
});
