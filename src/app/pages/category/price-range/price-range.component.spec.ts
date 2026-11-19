import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { PRICE_DEBOUNCE_MS, PriceRange, PriceRangeComponent, parseAmount } from './price-range.component';

describe('PriceRangeComponent', () => {
  let fixture: ComponentFixture<PriceRangeComponent>;
  let component: PriceRangeComponent;
  let el: HTMLElement;
  let emitted: PriceRange[];

  const ranges = () => Array.from(el.querySelectorAll<HTMLInputElement>('input[type=range]'));
  const fields = () => Array.from(el.querySelectorAll<HTMLInputElement>('input[type=text]'));

  function setup(floor: number, ceiling: number, value: PriceRange = { min: null, max: null }): void {
    fixture = TestBed.createComponent(PriceRangeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('floor', floor);
    fixture.componentRef.setInput('ceiling', ceiling);
    fixture.componentRef.setInput('value', value);
    emitted = [];
    component.rangeChange.subscribe(r => emitted.push(r));
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  function type(index: number, text: string): void {
    const input = fields()[index];
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function slide(index: number, value: number): void {
    const input = ranges()[index];
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('ค่าเริ่มต้น = ราคาต่ำสุด/สูงสุดจริงของหมวด และแถบเลื่อนมีชื่อสำหรับ screen reader', () => {
    setup(11599, 235990);
    expect(fields().map(f => f.value)).toEqual(['11,599', '235,990']);
    expect(ranges().map(r => r.getAttribute('aria-label'))).toEqual(['ราคาต่ำสุด', 'ราคาสูงสุด']);
    expect(ranges()[0].getAttribute('aria-valuetext')).toBe('฿11,599');
  });

  it('ค่าจาก URL แสดงในช่องและตำแหน่งหัวจับ', () => {
    setup(0, 100000, { min: 20000, max: 40000 });
    expect(fields().map(f => f.value)).toEqual(['20,000', '40,000']);
    expect(component.minPercent).toBe(20);
    expect(component.maxPercent).toBe(40);
  });

  it('พิมพ์ -> หัวจับขยับตามทันที แต่กรองหลังหยุดพิมพ์ 0.4 วิ ครั้งเดียว', fakeAsync(() => {
    setup(0, 100000);
    type(0, '1');
    type(0, '10');
    type(0, '10000');
    expect(component.minPercent).toBe(10);
    tick(PRICE_DEBOUNCE_MS - 1);
    expect(emitted).toEqual([]);
    tick(1);
    expect(emitted).toEqual([{ min: 10000, max: null }]);
  }));

  it('ลากแถบ -> ช่องกรอกเปลี่ยนตาม; หัวต่ำสุดลากเกินหัวสูงสุดไม่ได้', fakeAsync(() => {
    setup(0, 100000, { min: null, max: 50000 });
    slide(0, 70000);
    expect(component.minPrice).toBe(50000);
    expect(fields()[0].value).toBe('50,000');
    tick(PRICE_DEBOUNCE_MS);
    expect(emitted).toEqual([{ min: 50000, max: 50000 }]);
  }));

  it('กรอกต่ำสุดมากกว่าสูงสุด -> สลับให้ถูก; ค่าที่ขอบช่วง = ไม่กรอง (null)', fakeAsync(() => {
    setup(0, 100000);
    type(0, '90,000');
    type(1, '30000');
    tick(PRICE_DEBOUNCE_MS);
    expect(emitted).toEqual([{ min: 30000, max: 90000 }]);
    fixture.detectChanges();
    expect(fields().map(f => f.value)).toEqual(['30,000', '90,000']);

    fixture.componentRef.setInput('value', { min: 30000, max: 90000 });
    fixture.detectChanges();
    type(0, '0');
    type(1, '999999');
    tick(PRICE_DEBOUNCE_MS);
    expect(emitted[1]).toEqual({ min: null, max: null });
  }));

  it('ไม่มีราคาในหมวด (floor = ceiling) -> ปิดการใช้งาน', () => {
    setup(0, 0);
    expect(ranges().every(r => r.disabled)).toBeTrue();
    expect(fields().every(f => f.disabled)).toBeTrue();
  });

  it('parseAmount รับตัวเลขมีจุลภาค/สัญลักษณ์บาท', () => {
    expect(parseAmount('฿12,500')).toBe(12500);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});
