import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OtpInputComponent } from './otp-input.component';

describe('OtpInputComponent', () => {
  let fixture: ComponentFixture<OtpInputComponent>;
  let component: OtpInputComponent;
  let boxes: HTMLInputElement[];
  let completed: jasmine.Spy;

  /** จำลองการพิมพ์: browser ใส่ค่าลง input ก่อนแล้วค่อยยิง event 'input' */
  function type(index: number, value: string): void {
    boxes[index].value = value;
    boxes[index].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function key(index: number, k: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: k, cancelable: true });
    boxes[index].dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function paste(index: number, text: string): void {
    const data = new DataTransfer();
    data.setData('text', text);
    boxes[index].dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OtpInputComponent] }).compileComponents();
    fixture = TestBed.createComponent(OtpInputComponent);
    component = fixture.componentInstance;
    completed = jasmine.createSpy('completed');
    component.completed.subscribe(completed);
    document.body.appendChild(fixture.nativeElement); // ให้ focus() ทำงานจริง
    fixture.detectChanges();
    boxes = Array.from(fixture.nativeElement.querySelectorAll('input'));
  });

  afterEach(() => fixture.nativeElement.remove());

  it('มี 6 ช่อง แต่ละช่องมี aria-label "หลักที่ n" และช่องแรกรองรับ one-time-code', () => {
    expect(boxes.length).toBe(6);
    expect(boxes.map(b => b.getAttribute('aria-label'))).toEqual(
      ['หลักที่ 1', 'หลักที่ 2', 'หลักที่ 3', 'หลักที่ 4', 'หลักที่ 5', 'หลักที่ 6']);
    expect(boxes[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(boxes.every(b => b.getAttribute('inputmode') === 'numeric')).toBeTrue();
  });

  it('พิมพ์ตัวเลขแล้วเลื่อนไปช่องถัดไปอัตโนมัติ', () => {
    boxes[0].focus();
    type(0, '4');
    expect(component.value).toBe('4');
    expect(document.activeElement).toBe(boxes[1]);
  });

  it('ไม่รับตัวอักษรที่ไม่ใช่ตัวเลข', () => {
    boxes[0].focus();
    type(0, 'a');
    expect(boxes[0].value).toBe('');
    expect(component.value).toBe('');
    expect(document.activeElement).toBe(boxes[0]);
  });

  it('Backspace ในช่องว่าง -> ลบช่องก่อนหน้าแล้วถอยกลับไปช่องนั้น', () => {
    type(0, '1');
    type(1, '2');
    boxes[2].focus();

    const event = key(2, 'Backspace');

    expect(event.defaultPrevented).toBeTrue();
    expect(component.digits).toEqual(['1', '', '', '', '', '']);
    expect(boxes[1].value).toBe('');
    expect(document.activeElement).toBe(boxes[1]);
  });

  it('ลูกศรซ้าย/ขวาเลื่อนช่องได้', () => {
    boxes[2].focus();
    key(2, 'ArrowLeft');
    expect(document.activeElement).toBe(boxes[1]);
    key(1, 'ArrowRight');
    key(2, 'ArrowRight');
    expect(document.activeElement).toBe(boxes[3]);
  });

  it('วางรหัส 6 หลักได้ในครั้งเดียว (ตัดอักขระอื่นทิ้ง) และ emit completed', () => {
    boxes[3].focus();
    paste(3, ' 12-34 56 ');

    expect(boxes.map(b => b.value).join('')).toBe('123456');
    expect(completed).toHaveBeenCalledOnceWith('123456');
    expect(document.activeElement).toBe(boxes[5]);
  });

  it('มือถือเติมรหัสทั้งชุดลงช่องแรก (one-time-code) -> กระจายครบทุกช่อง', () => {
    boxes[0].focus();
    type(0, '987654');
    expect(component.value).toBe('987654');
    expect(completed).toHaveBeenCalledOnceWith('987654');
  });

  it('พิมพ์ครบ 6 หลักทีละตัว -> emit completed ครั้งเดียว', () => {
    '135790'.split('').forEach((d, i) => type(i, d));
    expect(completed).toHaveBeenCalledOnceWith('135790');
  });

  it('clear() ล้างทุกช่อง', () => {
    paste(0, '123456');
    component.clear();
    fixture.detectChanges();
    expect(boxes.every(b => b.value === '')).toBeTrue();
    expect(component.value).toBe('');
  });
});
