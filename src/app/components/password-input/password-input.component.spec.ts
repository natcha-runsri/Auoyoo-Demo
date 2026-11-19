import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PasswordInputComponent } from './password-input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, PasswordInputComponent],
  template: `<app-password-input inputId="pw" [formControl]="control" [invalid]="invalid"></app-password-input>`
})
class HostComponent {
  control = new FormControl('', { nonNullable: true });
  invalid = false;
}

describe('PasswordInputComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    return { fixture, el, input: el.querySelector('input') as HTMLInputElement, eye: el.querySelector('button') as HTMLButtonElement };
  }

  it('ซ่อนรหัสผ่านเป็นค่าเริ่มต้น ปุ่มตาสลับแสดง/ซ่อน', () => {
    const { fixture, input, eye } = setup();
    expect(input.type).toBe('password');
    expect(eye.getAttribute('aria-label')).toBe('แสดงรหัสผ่าน');
    eye.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    expect(eye.getAttribute('aria-label')).toBe('ซ่อนรหัสผ่าน');
  });

  it('ผูกค่ากับ FormControl ได้ทั้งสองทาง', () => {
    const { fixture, input } = setup();
    input.value = 'Secret!123';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.control.value).toBe('Secret!123');

    fixture.componentInstance.control.setValue('');
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('invalid -> aria-invalid และกรอบแดง', () => {
    const { fixture, el, input } = setup();
    fixture.componentInstance.invalid = true;
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('.pw-invalid')).not.toBeNull();
  });
});
