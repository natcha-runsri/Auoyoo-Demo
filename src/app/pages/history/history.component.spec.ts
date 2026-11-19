import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';

import { HistoryComponent } from './history.component';
import { HistoryItem, HistoryService, HistorySummary } from '../../services/history/history.service';
import { addDays, todayInBangkok } from './history-dates';

@Component({ standalone: true, template: '' })
class BlankComponent {}

const ITEMS: HistoryItem[] = [
  { id: 1, type: 'SEARCH', source: 'AI', title: 'โน้ตบุ๊กเล่นเกม งบไม่เกิน 30,000', productId: null, category: 'Notebook', time: '19:00', createdAt: '' },
  { id: 2, type: 'VIEW', source: 'PRODUCT', title: 'VoltBook Air 14', productId: 101, category: 'Notebook', time: '19:30', createdAt: '' },
  { id: 3, type: 'SEARCH', source: 'CATEGORY', title: 'จอ 27 นิ้ว', productId: null, category: 'Monitor', time: '22:00', createdAt: '' },
  { id: 4, type: 'VIEW', source: 'PRODUCT', title: 'สินค้าที่ถูกลบ', productId: null, category: 'Mouse', time: '22:30', createdAt: '' }
];

function summaryOf(date: string, range: 7 | 30, enough = true): HistorySummary {
  return {
    from: addDays(date, -(range - 1)), to: date, rangeDays: range,
    categoryTotal: enough ? 4 : 1,
    categories: enough
      ? [{ key: 'Notebook', label: 'โน้ตบุ๊ค', count: 2, percent: 50 }, { key: 'Monitor', label: 'จอมอนิเตอร์', count: 1, percent: 25 },
         { key: 'Mouse', label: 'เมาส์', count: 1, percent: 25 }]
      : [{ key: 'Mouse', label: 'เมาส์', count: 1, percent: 100 }],
    priceTotal: 0, priceRanges: []
  };
}

describe('HistoryComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let api: jasmine.SpyObj<HistoryService>;
  let page: HistoryComponent;
  let el: HTMLElement;
  const today = todayInBangkok();

  const text = (selector: string) => el.querySelector(selector)?.textContent?.trim() ?? '';
  const rows = () => Array.from(el.querySelectorAll('.item'));
  const settle = async () => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  async function open(url: string): Promise<void> {
    page = await harness.navigateByUrl(url, HistoryComponent);
    el = harness.routeNativeElement!;
    await settle();
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<HistoryService>('HistoryService', ['getDay', 'getSummary', 'getActiveDays', 'delete', 'deleteAll']);
    api.getDay.and.callFake(date => of({ date, items: date === '2026-08-11' ? [...ITEMS] : [] }));
    api.getSummary.and.callFake((date, range) => of(summaryOf(date, range)));
    api.getActiveDays.and.returnValue(of(['2026-08-03', '2026-08-11']));
    api.delete.and.returnValue(of(undefined));
    api.deleteAll.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'history', component: HistoryComponent },
          { path: 'products/:id', component: BlankComponent },
          { path: 'recommendations', component: BlankComponent },
          { path: 'category', component: BlankComponent },
          { path: '', component: BlankComponent }
        ]),
        { provide: HistoryService, useValue: api }
      ]
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  // ===================== หัว / วันที่ =====================

  it('หัวหน้า breadcrumb + หัวข้อ และไม่มี ?date = วันนี้ (เวลาไทย)', async () => {
    await open('/history');
    expect(text('.crumbs a')).toBe('หน้าหลัก');
    expect(el.querySelector('.crumbs a')?.getAttribute('href')).toBe('/');
    expect(text('.hist-title')).toBe('ประวัติและวิเคราะห์การใช้งาน');
    expect(api.getDay).toHaveBeenCalledWith(today);
    expect(api.getSummary).toHaveBeenCalledWith(today, 7);
    expect((el.querySelector('[aria-label="วันถัดไป"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('?date ใน URL -> แสดงวันนั้นแบบไทยเต็ม (รีเฟรชแล้วอยู่วันเดิม)', async () => {
    await open('/history?date=2026-08-11');
    expect(text('.date-label')).toBe('วันอังคารที่ 11 สิงหาคม 2569');
    expect(api.getDay).toHaveBeenCalledWith('2026-08-11');
    expect(rows().length).toBe(4);
  });

  it('?date วันอนาคต/ผิดรูป -> ใช้วันนี้และแก้ URL', async () => {
    await open(`/history?date=${addDays(today, 3)}`);
    expect(page.date).toBe(today);
    expect(router.url).toBe(`/history?date=${today}`);
    await open('/history?date=2026-13-45');
    expect(page.date).toBe(today);
  });

  it('ปุ่ม < > เปลี่ยนวันใน URL และ "วันนี้" กลับวันปัจจุบัน', async () => {
    await open('/history?date=2026-08-11');
    (el.querySelector('[aria-label="วันก่อนหน้า"]') as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe('/history?date=2026-08-10');
    expect(api.getDay).toHaveBeenCalledWith('2026-08-10');
    (el.querySelector('[aria-label="วันถัดไป"]') as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe('/history?date=2026-08-11');
    (el.querySelector('.today-btn') as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe(`/history?date=${today}`);
  });

  it('ปฏิทิน: เปิดจากไอคอน โหลดจุดของเดือน เลือกวันแล้วปิด; Esc / คลิกด้านนอกก็ปิด', async () => {
    await open('/history?date=2026-08-11');
    (el.querySelector('.cal-btn') as HTMLButtonElement).click();
    await settle();
    expect(api.getActiveDays).toHaveBeenCalledWith('2026-08');
    expect(el.querySelector('[data-date="2026-08-03"]')?.classList).toContain('has-history');
    (el.querySelector('[data-date="2026-08-03"]') as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector('app-history-calendar')).toBeNull();
    expect(router.url).toBe('/history?date=2026-08-03');

    (el.querySelector('.cal-btn') as HTMLButtonElement).click();
    await settle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(el.querySelector('app-history-calendar')).toBeNull();

    (el.querySelector('.cal-btn') as HTMLButtonElement).click();
    await settle();
    document.body.click();
    harness.detectChanges();
    expect(el.querySelector('app-history-calendar')).toBeNull();
  });

  // ===================== รายการ =====================

  it('แต่ละแถว: ข้อความ ป้าย "ค้นหา"/"เข้าชม" และเวลา', async () => {
    await open('/history?date=2026-08-11');
    const [search, view] = rows();
    expect(search.querySelector('.item-text')?.textContent).toBe('โน้ตบุ๊กเล่นเกม งบไม่เกิน 30,000');
    expect(search.querySelector('.badge')?.textContent?.trim()).toBe('ค้นหา');
    expect(search.querySelector('.item-time')?.textContent).toBe('19:00 น.');
    expect(view.querySelector('.item-text')?.textContent).toBe('เข้าชม VoltBook Air 14');
    expect(view.querySelector('.badge')?.classList).toContain('badge-view');
  });

  it('กดรายการ: ค้นหาผ่าน AI -> /recommendations?q, ค้นจากหน้าหมวด -> /category?q, เข้าชม -> หน้าสินค้า', async () => {
    await open('/history?date=2026-08-11');
    const links = rows().map(r => r.querySelector('a.item-main')?.getAttribute('href') ?? null);
    expect(decodeURIComponent(links[0]!)).toBe('/recommendations?q=โน้ตบุ๊กเล่นเกม งบไม่เกิน 30,000');
    expect(links[1]).toBe('/products/101');
    expect(decodeURIComponent(links[2]!)).toBe('/category?q=จอ 27 นิ้ว');
    expect(links[3]).toBeNull(); // สินค้าถูกลบไปแล้ว กดไม่ได้
  });

  it('แชท AI ที่เก็บบทสนทนาไว้: ป้าย "แชท AI" + จำนวนคำถาม กดแล้วเปิดอ่านแชทเดิม (/history/chat/:id) ไม่ค้นใหม่', async () => {
    api.getDay.and.returnValue(of({ date: '2026-08-11', items: [{
      id: 8, type: 'SEARCH', source: 'AI', title: 'โน้ตบุ๊ค ram เกิน 16', productId: null, category: 'Notebook', time: '18:00',
      createdAt: '', chatId: 42, questionCount: 3
    }, {
      id: 10, type: 'SEARCH', source: 'AI', title: 'เมาส์', productId: null, category: 'Mouse', time: '18:30',
      createdAt: '', chatId: 43, questionCount: 1
    }] }));
    await open('/history?date=2026-08-11');
    const [chat, single] = rows();
    expect(chat.querySelector('.badge')?.textContent?.trim()).toBe('แชท AI');
    expect(chat.querySelector('.item-text')?.textContent).toBe('โน้ตบุ๊ค ram เกิน 16 (+2 คำถาม)');
    const link = chat.querySelector('a.item-main')!;
    expect(link.getAttribute('href')).toBe('/history/chat/42');
    expect(link.getAttribute('aria-label')).toContain('เปิดอ่านแชท AI: โน้ตบุ๊ค ram เกิน 16');
    expect(single.querySelector('.item-text')?.textContent).toBe('เมาส์');
  });

  it('การเปรียบเทียบ: ป้าย "เปรียบเทียบ" กดแล้วเปิดชุดเดิม (/recommendations?ids=) และมีชื่อสินค้าใน tooltip', async () => {
    api.getDay.and.returnValue(of({ date: '2026-08-11', items: [{
      id: 9, type: 'SEARCH', source: 'COMPARE', title: 'เปรียบเทียบ 3 รายการ', productId: null, category: null, time: '20:00',
      createdAt: '', compareIds: [12, 5, 40], detail: 'A / B / C'
    }] }));
    await open('/history?date=2026-08-11');
    const [row] = rows();
    expect(row.querySelector('.badge')?.textContent?.trim()).toBe('เปรียบเทียบ');
    const link = row.querySelector('a.item-main')!;
    expect(decodeURIComponent(link.getAttribute('href')!)).toBe('/recommendations?ids=12,5,40');
    expect(link.getAttribute('title')).toBe('A / B / C');
    expect(link.getAttribute('aria-label')).toContain('เปิดการเปรียบเทียบอีกครั้ง: เปรียบเทียบ 3 รายการ');
  });

  it('ตัวกรอง: เปิดด้วยคีย์บอร์ด เลือก "การเข้าชม" ชื่อปุ่มเปลี่ยนตาม และแสดงเฉพาะการเข้าชม', async () => {
    await open('/history?date=2026-08-11');
    const button = el.querySelector('.filter-btn') as HTMLButtonElement;
    expect(button.textContent).toContain('กรอง: ทั้งหมด');
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await settle();
    const options = Array.from(el.querySelectorAll<HTMLButtonElement>('.filter-item'));
    expect(options.map(o => o.textContent?.replace(/^\S+?(?=[ก-๙])/, '').trim())).toEqual(['ทั้งหมด', 'การค้นหา', 'การเข้าชม']);
    expect(document.activeElement).toBe(options[0]);
    options[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(document.activeElement).toBe(options[2]);
    options[2].click();
    harness.detectChanges();
    expect(button.textContent).toContain('กรอง: การเข้าชม');
    expect(rows().length).toBe(2);
    expect(rows().every(r => r.querySelector('.badge')?.textContent?.trim() === 'เข้าชม')).toBeTrue();
    expect(document.activeElement).toBe(button);
  });

  it('วันที่ไม่มีประวัติ -> "ไม่มีประวัติในวันนี้"', async () => {
    await open('/history?date=2026-08-01');
    expect(rows().length).toBe(0);
    expect(text('.empty p')).toBe('ไม่มีประวัติในวันนี้');
  });

  // ===================== ลบ =====================

  it('ลบรายการเดียว -> หายจากรายการ และกราฟโหลดใหม่', async () => {
    await open('/history?date=2026-08-11');
    api.getSummary.calls.reset();
    (rows()[1].querySelector('.item-delete') as HTMLButtonElement).click();
    await settle();
    expect(api.delete).toHaveBeenCalledOnceWith(2);
    expect(rows().length).toBe(3);
    expect(api.getSummary).toHaveBeenCalledWith('2026-08-11', 7);
    expect(document.activeElement?.classList).toContain('item-delete');
  });

  it('ลบรายการไม่สำเร็จ -> แจ้ง error และรายการยังอยู่', async () => {
    await open('/history?date=2026-08-11');
    api.delete.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    (rows()[0].querySelector('.item-delete') as HTMLButtonElement).click();
    await settle();
    expect(rows().length).toBe(4);
    expect(text('.col-foot .delete-error')).toBe('ลบรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  });

  it('ลบทั้งหมดต้องยืนยันก่อน: ยกเลิกไม่ลบ / ยืนยันแล้วรายการและกราฟว่าง', async () => {
    await open('/history?date=2026-08-11');
    (el.querySelector('.delete-all') as HTMLButtonElement).click();
    await settle();
    const dialog = el.querySelector('[role="alertdialog"]')!;
    expect(dialog.textContent).toContain('ลบประวัติทั้งหมด?');
    expect(dialog.querySelector('#confirm-desc')?.textContent)
      .toBe('ประวัติการค้นหาและเข้าชมทั้งหมดของคุณ (ทุกวัน) จะถูกลบถาวร และกู้คืนไม่ได้');
    expect(getComputedStyle(dialog.querySelector('.btn-danger')!).backgroundColor).toBe('rgb(211, 47, 47)');
    expect(document.activeElement?.textContent?.trim()).toBe('ยกเลิก');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    expect(api.deleteAll).not.toHaveBeenCalled();

    api.getSummary.and.callFake((date, range) => of({ ...summaryOf(date, range), categoryTotal: 0, categories: [] }));
    (el.querySelector('.delete-all') as HTMLButtonElement).click();
    await settle();
    (el.querySelector('.btn-danger') as HTMLButtonElement).click();
    await settle();
    expect(api.deleteAll).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
    expect(text('.empty p')).toBe('ไม่มีประวัติในวันนี้');
    expect(el.querySelector('app-history-analysis')?.textContent).toContain('ยังมีข้อมูลไม่พอสำหรับวิเคราะห์');
  });

  // ===================== วิเคราะห์ =====================

  it('ค่าเริ่มต้น 7 วัน แสดงช่วงวันที่ กราฟ คำอธิบายสี และข้อความสรุป', async () => {
    await open('/history?date=2026-08-11');
    const analysis = el.querySelector('app-history-analysis')!;
    const toggles = Array.from(analysis.querySelectorAll<HTMLButtonElement>('.range-toggle button'));
    expect(toggles.map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(analysis.querySelector('.range-label')?.textContent).toBe('5 – 11 ส.ค. 2569');
    expect(analysis.querySelectorAll('.card')[0].querySelectorAll('.legend li').length).toBe(3);
    expect(analysis.querySelector('.card .insight')?.textContent).toContain('โน้ตบุ๊ค มากที่สุด คิดเป็น 50%');
    expect(analysis.querySelector('.card svg')?.getAttribute('aria-label')).toBe('หมวดหมู่ที่สนใจ: โน้ตบุ๊ค 50%, จอมอนิเตอร์ 25%, เมาส์ 25%');
    // การ์ดช่วงราคาไม่มีข้อมูล
    expect(analysis.querySelectorAll('.card')[1].textContent).toContain('ยังมีข้อมูลไม่พอสำหรับวิเคราะห์');
  });

  it('สลับเป็น 30 วัน -> เก็บใน URL โหลดกราฟใหม่ แต่รายการฝั่งซ้ายไม่โหลดซ้ำ', async () => {
    await open('/history?date=2026-08-11');
    api.getDay.calls.reset();
    (el.querySelectorAll('.range-toggle button')[1] as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe('/history?date=2026-08-11&range=30');
    expect(api.getSummary).toHaveBeenCalledWith('2026-08-11', 30);
    expect(api.getDay).not.toHaveBeenCalled();
    expect(text('.range-label')).toBe('13 ก.ค. – 11 ส.ค. 2569');
  });

  it('ข้อมูลไม่พอ -> วงเทาและข้อความแทนคำอธิบายสี', async () => {
    api.getSummary.and.callFake((date, range) => of(summaryOf(date, range, false)));
    await open('/history?date=2026-08-11');
    const card = el.querySelector('app-history-analysis .card')!;
    expect(card.querySelectorAll('circle.seg').length).toBe(0);
    expect(card.querySelector('.legend')).toBeNull();
    expect(card.textContent).toContain('ยังมีข้อมูลไม่พอสำหรับวิเคราะห์');
  });
});
