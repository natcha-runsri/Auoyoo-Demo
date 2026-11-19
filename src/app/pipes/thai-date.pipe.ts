import { Pipe, PipeTransform } from '@angular/core';

const THAI_SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/**
 * "2026-08-20" (หรือ "2026-08-20T13:45:00") -> "20 ส.ค. 2569" (ปี พ.ศ.)
 * อ่านตัวเลขจากข้อความตรง ๆ ไม่แปลงผ่าน Date -> ไม่มีปัญหาวันเลื่อนเพราะ timezone ของเครื่องผู้ใช้
 */
export function formatThaiDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return '';
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return '';
  return `${Number(day)} ${THAI_SHORT_MONTHS[monthIndex]} ${Number(year) + 543}`;
}

@Pipe({ name: 'thaiDate', standalone: true })
export class ThaiDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatThaiDate(value);
  }
}
