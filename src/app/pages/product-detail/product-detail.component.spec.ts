import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { ProductDetailComponent } from './product-detail.component';
import { ProductService } from '../../services/product/product.service';
import { Product } from '../../models/product';
import { HistoryService } from '../../services/history/history.service';

// ลิงก์ร้านปลอม — เทสต์ไม่คลิก/ไม่โหลดลิงก์นี้ และห้ามใช้ลิงก์ร้านค้าจริง
const product: Product = {
  id: 7, category: 'Notebook', productName: 'Test Notebook', priceMin: 19990,
  url: 'https://shop.example.invalid/p/7', image: '', source: 'demo-a', priceAsOf: '2026-08-20'
};

describe('ProductDetailComponent', () => {
  let fixture: ComponentFixture<ProductDetailComponent>;
  let el: HTMLElement;
  let history: jasmine.SpyObj<HistoryService>;

  beforeEach(async () => {
    history = jasmine.createSpyObj<HistoryService>('HistoryService', ['recordView']);
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: ProductService, useValue: { getById: () => of(product) } },
        { provide: HistoryService, useValue: history }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProductDetailComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('เปิดหน้าสินค้า -> บันทึกประวัติการเข้าชม (service ข้ามเองถ้าไม่ได้ล็อกอิน)', () => {
    expect(history.recordView).toHaveBeenCalledOnceWith(7);
  });

  it('ปุ่มไปร้านระบุชื่อร้าน เปิดแท็บใหม่ และมี rel="noopener"', () => {
    const link = el.querySelector('a.pd-source-link') as HTMLAnchorElement;
    expect(link.textContent).toContain('ดูที่ร้าน ร้านตัวอย่าง A');
    expect(link.getAttribute('href')).toBe(product.url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('title/description เฉพาะสินค้า และ canonical เป็นหน้าสินค้านั้น', () => {
    expect(TestBed.inject(Title).getTitle()).toBe('Test Notebook - ราคาและสเปก | AuoYoo');
    const description = TestBed.inject(Meta).getTag('name="description"')?.content ?? '';
    expect(description).toContain('Test Notebook ราคา ฿19,990 (ณ วันที่ 20 ส.ค. 2569)');
    expect(description).toContain('จากร้าน ร้านตัวอย่าง A');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/products\/7$/);
  });

  it('แสดงวันที่ของราคา และรูป mockup ตามหมวด (ไม่มีลิงก์รูป)', () => {
    expect(el.querySelector('.pd-price-date')?.textContent?.trim()).toBe('ราคา ณ วันที่ 20 ส.ค. 2569');
    expect(el.querySelector('img.pd-image')?.getAttribute('src')).toBe('images/mockups/notebook.svg');
  });
});
