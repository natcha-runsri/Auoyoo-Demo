import { TestBed } from '@angular/core/testing';
import { StepperComponent } from './stepper.component';

describe('StepperComponent', () => {
  function render(current: number): HTMLElement {
    const fixture = TestBed.createComponent(StepperComponent);
    fixture.componentRef.setInput('steps', ['อีเมลใหม่', 'รหัสยืนยัน', 'เสร็จสิ้น']);
    fixture.componentRef.setInput('current', current);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('ขั้นปัจจุบัน = วงทึบตัวเลข (aria-current), ขั้นก่อนหน้า = เครื่องหมายถูก, ขั้นถัดไป = วงขอบตัวเลข', () => {
    const el = render(1);
    const steps = el.querySelectorAll('li');
    expect(steps.length).toBe(3);
    expect(steps[0].classList).toContain('done');
    expect(steps[0].querySelector('.circle')?.textContent).toContain('check');
    expect(steps[1].classList).toContain('current');
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(steps[1].querySelector('.circle')?.textContent?.trim()).toBe('2');
    expect(steps[2].classList).toContain('todo');
    expect(steps[2].querySelector('.circle')?.textContent?.trim()).toBe('3');
    expect(steps[2].getAttribute('aria-current')).toBeNull();
  });

  it('current >= จำนวนขั้น -> ผ่านครบทุกขั้น', () => {
    const el = render(3);
    expect(el.querySelectorAll('li.done').length).toBe(3);
    expect(el.querySelector('[aria-current]')).toBeNull();
  });
});
