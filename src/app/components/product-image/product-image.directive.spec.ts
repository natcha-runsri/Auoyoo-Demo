import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductImageDirective, ProductImageSource } from './product-image.directive';
import { GENERIC_MOCKUP, USE_REMOTE_PRODUCT_IMAGES, productMockupUrl } from '../../config/product-images';

// ลิงก์ปลอม (.invalid ไม่มีอยู่จริง) — หน้าเทสต์บล็อกรูปภายนอกด้วย CSP อยู่แล้ว จึงได้ error จริงโดยไม่ออกเน็ต
// ห้ามใช้ลิงก์รูปของร้านค้าจริงในเทสต์
const FAKE_REMOTE = 'https://images.example.invalid/product-1.jpg';

@Component({
  standalone: true,
  imports: [ProductImageDirective],
  template: `<img [appProductImage]="product" alt="x" />`
})
class HostComponent {
  product: ProductImageSource | null = { image: FAKE_REMOTE, category: 'Notebook' };
}

function setup(useRemote: boolean): ComponentFixture<HostComponent> {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: USE_REMOTE_PRODUCT_IMAGES, useValue: useRemote }]
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

const img = (fixture: ComponentFixture<HostComponent>) => fixture.nativeElement.querySelector('img') as HTMLImageElement;

describe('ProductImageDirective', () => {
  it('ค่าเริ่มต้นตอนเทสต์ (environment.test) ปิดรูปจากร้านค้า', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(USE_REMOTE_PRODUCT_IMAGES)).toBeFalse();
  });

  it('เปิดรูปจากร้าน: ใช้ลิงก์ของสินค้า พร้อม loading="lazy" และ referrerpolicy="no-referrer"', () => {
    const fixture = setup(true);
    expect(img(fixture).getAttribute('src')).toBe(FAKE_REMOTE);
    expect(img(fixture).getAttribute('loading')).toBe('lazy');
    expect(img(fixture).getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('รูปร้านโหลดไม่ได้ -> เปลี่ยนเป็น mockup ของหมวดแทนไอคอนรูปแตก', async () => {
    const fixture = setup(true);
    await new Promise(resolve => img(fixture).addEventListener('error', resolve, { once: true }));
    fixture.detectChanges();
    expect(img(fixture).getAttribute('src')).toBe('images/mockups/notebook.svg');
  });

  it('ปิดรูปจากร้าน: ใช้ mockup ตั้งแต่แรก ไม่ใส่ลิงก์ร้านเลย', () => {
    const fixture = setup(false);
    expect(img(fixture).getAttribute('src')).toBe('images/mockups/notebook.svg');
    expect(fixture.nativeElement.innerHTML).not.toContain(FAKE_REMOTE);
  });

  it('สินค้าไม่มีลิงก์รูป -> mockup ของหมวดแม้เปิดรูปจากร้าน', () => {
    const fixture = setup(true);
    fixture.componentInstance.product = { image: '', category: 'Printer' };
    fixture.detectChanges();
    expect(img(fixture).getAttribute('src')).toBe('images/mockups/printer.svg');
  });

  it('หมวดที่ไม่รู้จัก -> mockup กลาง', () => {
    const fixture = setup(false);
    fixture.componentInstance.product = { image: FAKE_REMOTE, category: 'Drone' };
    fixture.detectChanges();
    expect(img(fixture).getAttribute('src')).toBe(GENERIC_MOCKUP);
  });

  it('error ซ้ำไม่วนไม่รู้จบ: mockup หมวด -> mockup กลาง แล้วหยุด', () => {
    const fixture = setup(true);
    const directive = fixture.debugElement.children[0].injector.get(ProductImageDirective);
    directive.onError();
    expect(directive.src).toBe('images/mockups/notebook.svg');
    directive.onError();
    expect(directive.src).toBe(GENERIC_MOCKUP);
    directive.onError();
    expect(directive.src).toBe(GENERIC_MOCKUP);
  });
});

describe('productMockupUrl', () => {
  // ทุกหมวดที่มีใน DB ตอนนี้ (SELECT DISTINCT category FROM products)
  const DB_CATEGORIES = ['Computer Hardware', 'Keyboard', 'Headphone', 'Mouse', 'Notebook', 'Monitor', 'Speaker',
    'Printer', 'Accessories', 'Mouse Pad', 'Computer Set', 'Computer / PC'];

  it('ทุกหมวดใน DB มี mockup ของตัวเอง (ไม่ตกไป mockup กลาง)', () => {
    for (const category of DB_CATEGORIES) {
      expect(productMockupUrl(category)).withContext(category).not.toBe(GENERIC_MOCKUP);
    }
    expect(productMockupUrl('Computer / PC')).toBe(productMockupUrl('Computer Set'));
    expect(productMockupUrl(' notebook ')).toBe('images/mockups/notebook.svg');
    expect(productMockupUrl(null)).toBe(GENERIC_MOCKUP);
  });

  it('ไฟล์ mockup ทุกไฟล์มีอยู่จริง (โหลดจากเครื่องเราเอง)', async () => {
    const urls = [...new Set([...DB_CATEGORIES.map(productMockupUrl), GENERIC_MOCKUP])];
    for (const url of urls) {
      const res = await fetch(url);
      expect(res.ok).withContext(url).toBeTrue();
      expect(await res.text()).withContext(url).toContain('<svg');
    }
  });
});
