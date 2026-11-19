import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HistoryCalendarComponent } from './history-calendar.component';
import { DonutChartComponent } from './donut-chart.component';

describe('HistoryCalendarComponent', () => {
  let fixture: ComponentFixture<HistoryCalendarComponent>;
  let component: HistoryCalendarComponent;
  let el: HTMLElement;

  const day = (date: string) => el.querySelector(`[data-date="${date}"]`) as HTMLButtonElement;
  const key = (k: string) => el.querySelector('table')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  function render(selected: string, today: string, active: string[] = []): void {
    fixture = TestBed.createComponent(HistoryCalendarComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('today', today);
    fixture.componentRef.setInput('activeDays', new Set(active));
    fixture.detectChanges();
  }

  it('แสดงเดือนของวันที่เลือก เริ่มวันจันทร์ วันนี้สีแดง และมีจุดใต้วันที่มีประวัติ', () => {
    render('2026-08-11', '2026-08-16', ['2026-08-03']);
    expect(el.querySelector('.cal-title')?.textContent).toBe('สิงหาคม 2569');
    expect(Array.from(el.querySelectorAll('th')).map(th => th.textContent)).toEqual(['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']);
    expect(day('2026-08-16').classList).toContain('today');
    expect(day('2026-08-16').getAttribute('aria-current')).toBe('date');
    expect(day('2026-08-11').classList).toContain('selected');
    expect(day('2026-08-03').classList).toContain('has-history');
    expect(day('2026-08-03').getAttribute('aria-label')).toBe('วันจันทร์ที่ 3 สิงหาคม 2569 (มีประวัติ)');
  });

  it('วันอนาคตเลือกไม่ได้ และเลื่อนไปเดือนอนาคตไม่ได้', () => {
    render('2026-08-11', '2026-08-16');
    const pick = spyOn(component.dateSelected, 'emit');
    expect(day('2026-08-17').disabled).toBeTrue();
    component.pick('2026-08-17');
    expect(pick).not.toHaveBeenCalled();
    expect((el.querySelectorAll('.cal-nav')[1] as HTMLButtonElement).disabled).toBeTrue();
  });

  it('คลิกวัน -> แจ้งวันที่เลือก; เปลี่ยนเดือน -> แจ้งเดือนใหม่ให้โหลดจุด', () => {
    render('2026-08-11', '2026-08-16');
    const pick = spyOn(component.dateSelected, 'emit');
    const month = spyOn(component.monthChange, 'emit');
    day('2026-08-09').click();
    expect(pick).toHaveBeenCalledWith('2026-08-09');
    (el.querySelectorAll('.cal-nav')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(month).toHaveBeenCalledWith('2026-07');
    expect(el.querySelector('.cal-title')?.textContent).toBe('กรกฎาคม 2569');
  });

  it('คีย์บอร์ด: ลูกศรเลื่อนวัน/สัปดาห์ (ไม่เกินวันนี้), Enter เลือก, Esc ปิด', () => {
    render('2026-08-11', '2026-08-16');
    const pick = spyOn(component.dateSelected, 'emit');
    const closed = spyOn(component.closed, 'emit');
    key('ArrowLeft');
    expect(component.focusDate).toBe('2026-08-10');
    key('ArrowUp');
    expect(component.focusDate).toBe('2026-08-03');
    key('ArrowUp');
    fixture.detectChanges();
    expect(component.focusDate).toBe('2026-07-27');
    expect(el.querySelector('.cal-title')?.textContent).toBe('กรกฎาคม 2569');
    key('PageDown');
    key('ArrowDown');
    key('ArrowDown');
    expect(component.focusDate).toBe('2026-08-16');
    key('Enter');
    expect(pick).toHaveBeenCalledWith('2026-08-16');
    key('Escape');
    expect(closed).toHaveBeenCalled();
  });
});

describe('DonutChartComponent', () => {
  it('แต่ละชิ้นยาวตามสัดส่วน และไม่มีข้อมูล = วงเทาอย่างเดียว พร้อมข้อความสำหรับ screen reader', () => {
    const fixture = TestBed.createComponent(DonutChartComponent);
    fixture.componentRef.setInput('slices', [
      { key: 'A', label: 'A', count: 3, percent: 75 }, { key: 'B', label: 'B', count: 1, percent: 25 }]);
    fixture.componentRef.setInput('colors', ['#f00', '#00f']);
    fixture.componentRef.setInput('ariaLabel', 'หมวดหมู่ที่สนใจ: A 75%, B 25%');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const segs = el.querySelectorAll('circle.seg');
    const circumference = 2 * Math.PI * 38;
    expect(segs.length).toBe(2);
    expect(segs[0].getAttribute('stroke')).toBe('#f00');
    expect(parseFloat(segs[0].getAttribute('stroke-dasharray')!)).toBeCloseTo(circumference * 0.75, 3);
    expect(parseFloat(segs[1].getAttribute('stroke-dashoffset')!)).toBeCloseTo(-circumference * 0.75, 3);
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('หมวดหมู่ที่สนใจ: A 75%, B 25%');

    fixture.componentRef.setInput('slices', []);
    fixture.detectChanges();
    expect(el.querySelectorAll('circle.seg').length).toBe(0);
    expect(el.querySelectorAll('circle.track').length).toBe(1);
  });
});
