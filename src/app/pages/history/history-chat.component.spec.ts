import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { HistoryChatComponent } from './history-chat.component';
import { HistoryService, SavedChat } from '../../services/history/history.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';
import { Product } from '../../models/product';

@Component({ standalone: true, template: '' })
class BlankComponent {}

const PRODUCT = {
  id: 101, category: 'Notebook', brand: 'ASUS', productName: 'Zenbook 14', specification: '32GB DDR5 / 1TB SSD',
  priceMin: 32900, priceMax: 32900, url: 'https://shop.example/101', image: '', source: 'shop', priceAsOf: '2026-10-01'
} as unknown as Product;

const CHAT: SavedChat = {
  id: 42, startedAt: '2026-10-20T05:00:00Z', updatedAt: '2026-10-20T05:03:00Z',
  messages: [
    { role: 'user', text: 'โน้ตบุ๊ค ram เกิน 16', products: [], createdAt: '2026-10-20T05:00:00Z' },
    { role: 'bot', text: 'กรองตามสเปค: RAM มากกว่า 16 GB\n\nรุ่นนี้เหมาะกับงานหนัก', products: [PRODUCT], createdAt: '2026-10-20T05:00:00Z' },
    { role: 'user', text: 'ถูกกว่านี้', products: [], createdAt: '2026-10-20T05:03:00Z' },
    { role: 'bot', text: 'ไม่พบสินค้าที่ถูกกว่านี้', products: [], createdAt: '2026-10-20T05:03:00Z' }
  ]
};

describe('HistoryChatComponent', () => {
  let harness: RouterTestingHarness;
  let api: jasmine.SpyObj<HistoryService>;
  let el: HTMLElement;

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url, HistoryChatComponent);
    el = harness.routeNativeElement!;
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<HistoryService>('HistoryService', ['getChat']);
    api.getChat.and.returnValue(of(CHAT));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'history/chat/:id', component: HistoryChatComponent },
          { path: 'history', component: BlankComponent },
          { path: 'recommendations', component: BlankComponent },
          { path: '', component: BlankComponent }
        ]),
        // การ์ดสินค้าใช้ CompareService / FavoriteService
        provideHttpClient(), provideHttpClientTesting(),
        { provide: HistoryService, useValue: api },
        { provide: UserProfileService, useValue: { currentUser$: new BehaviorSubject({ avatarUrl: 'images/me.png' }) } }
      ]
    });
    harness = await RouterTestingHarness.create();
  });

  it('แสดงบทสนทนาเดิมครบ (คำถาม คำตอบ สินค้า ณ ตอนนั้น) ตามลำดับ', async () => {
    await open('/history/chat/42');
    expect(api.getChat).toHaveBeenCalledWith(42);
    const messages = Array.from(el.querySelectorAll('.msg'));
    expect(messages.length).toBe(4);
    expect(messages.map(m => m.classList.contains('user'))).toEqual([true, false, true, false]);
    expect(messages[0].querySelector('.bubble')?.textContent).toContain('โน้ตบุ๊ค ram เกิน 16');
    expect(messages[1].querySelector('.bubble')?.textContent).toContain('รุ่นนี้เหมาะกับงานหนัก');
    expect(messages[1].querySelectorAll('app-product-card').length).toBe(1);
    expect(messages[1].textContent).toContain('Zenbook 14');
    expect(messages[3].querySelector('app-product-card')).toBeNull();
    expect((messages[0].querySelector('img.avatar') as HTMLImageElement).getAttribute('src')).toBe('images/me.png');
  });

  it('อ่านอย่างเดียว: ไม่มีช่องพิมพ์ มีป้ายบอก และปุ่มเริ่มแชทใหม่/กลับหน้าประวัติ', async () => {
    await open('/history/chat/42');
    expect(el.querySelector('textarea')).toBeNull();
    expect(el.querySelector('.hc-note')?.textContent).toContain('เปิดอ่านได้อย่างเดียว');
    expect(el.querySelector('.hc-meta')?.textContent).toContain('เริ่มแชทเมื่อ');
    const hrefs = Array.from(el.querySelectorAll('.hc-actions a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/history', '/recommendations']);
  });

  it('แชทถูกลบ / ไม่ใช่ของเรา (404) -> บอกว่าไม่พบ และมีลิงก์กลับ', async () => {
    api.getChat.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await open('/history/chat/42');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('ไม่พบแชทนี้');
    expect(el.querySelector('.msg')).toBeNull();
  });

  it('โหลดไม่สำเร็จ -> กดลองใหม่ได้', async () => {
    api.getChat.and.returnValues(throwError(() => new HttpErrorResponse({ status: 500 })), of(CHAT));
    await open('/history/chat/42');
    const retry = el.querySelector('[role="alert"] button') as HTMLButtonElement;
    expect(retry.textContent).toContain('ลองใหม่');
    retry.click();
    harness.detectChanges();
    expect(el.querySelectorAll('.msg').length).toBe(4);
  });

  it('รหัสแชทไม่ใช่ตัวเลข -> ไม่พบ โดยไม่เรียก API', async () => {
    await open('/history/chat/abc');
    expect(api.getChat).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('ไม่พบแชทนี้');
  });
});
