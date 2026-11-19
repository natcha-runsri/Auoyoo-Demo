import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { RecommendationsComponent } from '../recommendations.component';
import { ProductService } from '../../../services/product/product.service';
import { RecommendService } from '../../../services/recommend/recommend.service';
import { HistoryService } from '../../../services/history/history.service';
import { AuthService } from '../../../services/authen/auth.service';
import { AuthModalService } from '../../../services/auth-modal/auth-modal.service';
import { CompareService } from '../../../services/compare/compare.service';
import { CompareAnalysis, CompareTable } from '../../../models/compare';
import { Product } from '../../../models/product';
import { GUEST_QUOTA_KEY } from '../../../services/recommend/ai-guest-quota';

@Component({ standalone: true, template: '' })
class BlankComponent {}

// ลิงก์ร้านปลอม — ห้ามใช้ลิงก์ร้านค้าจริงในเทสต์
const product = (id: number, name: string, spec = ''): Product =>
  ({ id, category: 'Computer Hardware', productName: name, url: `https://shop.example.invalid/${id}`, specification: spec, priceMin: 0 });

const TABLE: CompareTable = {
  products: [
    { product: product(1, 'GALAX RTX 5060', 'สเปกเต็ม A'), categoryLabel: 'ฮาร์ดแวร์คอมพิวเตอร์', categoryKey: 'Computer Hardware', kind: 'GPU', kindLabel: 'การ์ดจอ' },
    { product: product(2, 'XYZ RX 9060 XT', 'สเปกเต็ม B'), categoryLabel: 'ฮาร์ดแวร์คอมพิวเตอร์', categoryKey: 'Computer Hardware', kind: 'GPU', kindLabel: 'การ์ดจอ' }
  ],
  rows: [
    { key: 'price', label: 'ราคา', group: 'basic', values: ['฿14,800', '฿15,900 – ฿16,500'], best: [0] },
    { key: 'brand', label: 'แบรนด์', group: 'basic', values: ['GALAX', 'ไม่ระบุแบรนด์'], best: [] },
    { key: 'category', label: 'หมวดหมู่', group: 'basic', values: ['ฮาร์ดแวร์คอมพิวเตอร์', 'ฮาร์ดแวร์คอมพิวเตอร์'], best: [] },
    { key: 'vram', label: 'หน่วยความจำ', group: 'spec', values: ['8 GB', '16 GB'], best: [1] },
    { key: 'ports', label: 'พอร์ตจอ', group: 'spec', values: ['3x DisplayPort, 1x HDMI', null], best: [] }
  ],
  sameKind: true,
  cheapestIds: [1]
};

const ANALYSIS: CompareAnalysis = {
  sameKind: true,
  overview: 'ภาพรวมจาก AI',
  products: [
    { id: 1, strengths: ['ราคาถูกกว่า', 'GDDR7'], caveats: ['หน่วยความจำ 8 GB'], suitedFor: 'เล่นเกม Full HD' },
    { id: 2, strengths: ['หน่วยความจำ 16 GB'], caveats: ['ไม่มีข้อมูลพอร์ตจอ'], suitedFor: 'งานกราฟิก' }
  ],
  recommendation: { id: 2, reason: 'หน่วยความจำมากกว่า' },
  scenarios: [{ condition: 'ถ้าคุณเน้นราคา', productId: 1 }, { condition: 'ถ้าคุณทำงานกราฟิก', productId: 2 }],
  bestValueId: 1, topSpecId: 2, analyzedAt: '2026-10-15T03:00:00Z', dataAsOf: '2026-10-14', cached: false
};

/** AI ถูก mock ทั้งหมด (ไม่เรียก Ollama จริง) */
describe('ComparePageComponent (/recommendations?ids=)', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let products: jasmine.SpyObj<ProductService>;
  let recommend: jasmine.SpyObj<RecommendService>;
  let history: jasmine.SpyObj<HistoryService>;
  let authModal: jasmine.SpyObj<AuthModalService>;
  let loggedIn$: BehaviorSubject<boolean>;

  const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const all = (sel: string) => Array.from(el.querySelectorAll<HTMLElement>(sel));
  const click = (target: Element | null) => (target as HTMLElement).click();

  async function open(url = '/recommendations?ids=1,2'): Promise<void> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement!;
  }

  function setup(isLoggedIn: boolean): void {
    loggedIn$ = new BehaviorSubject(isLoggedIn);
    products = jasmine.createSpyObj<ProductService>('ProductService', ['compareTable']);
    products.compareTable.and.returnValue(of(TABLE));
    recommend = jasmine.createSpyObj<RecommendService>('RecommendService', ['compareAnalysis', 'compareAsk', 'query', 'getAuto']);
    recommend.compareAnalysis.and.returnValue(of(ANALYSIS));
    history = jasmine.createSpyObj<HistoryService>('HistoryService', ['recordCompare']);
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['open']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'recommendations', component: RecommendationsComponent }, { path: '**', component: BlankComponent }]),
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ProductService, useValue: products },
        { provide: RecommendService, useValue: recommend },
        { provide: HistoryService, useValue: history },
        { provide: AuthModalService, useValue: authModal },
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn$.value, loggedIn$: loggedIn$.asObservable() } }
      ]
    });
  }

  beforeEach(async () => {
    localStorage.removeItem(GUEST_QUOTA_KEY);
    setup(true);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => localStorage.removeItem(GUEST_QUOTA_KEY));

  it('หัวหน้า: breadcrumb + "เปรียบเทียบสินค้า 2 รายการ" และบันทึกประวัติการเปรียบเทียบ', async () => {
    await open();
    expect(text('.crumbs')).toBe('หน้าหลัก/เปรียบเทียบสินค้า');
    expect(text('.cmp-title')).toBe('เปรียบเทียบสินค้า 2 รายการ');
    expect(products.compareTable).toHaveBeenCalledOnceWith([1, 2]);
    expect(history.recordCompare).toHaveBeenCalledOnceWith([1, 2]);
  });

  it('แสดงผลวิเคราะห์: ภาพรวม จุดเด่น/ข้อควรรู้ เหมาะกับ คำแนะนำ กรณีเลือก และวันที่ข้อมูล', async () => {
    await open();
    expect(recommend.compareAnalysis).toHaveBeenCalledOnceWith([1, 2], false);
    expect(text('.overview')).toBe('ภาพรวมจาก AI');
    expect(all('.product .good').length).toBe(3);
    expect(all('.product .warn').length).toBe(2);
    expect(text('.product .fit')).toBe('เหมาะกับ: เล่นเกม Full HD');
    expect(text('.pick-title')).toContain('AI แนะนำ: XYZ RX 9060 XT');
    expect(all('.cases li').map(li => li.textContent!.replace(/\s+/g, ' ').trim()))
      .toEqual(['ถ้าคุณเน้นราคา → ให้เลือก GALAX RTX 5060', 'ถ้าคุณทำงานกราฟิก → ให้เลือก XYZ RX 9060 XT']);
    expect(text('.foot')).toContain('ผลวิเคราะห์โดย AI จากข้อมูลสินค้า ณ วันที่');
    expect(text('.foot')).toContain('อาจคลาดเคลื่อนได้');
  });

  it('การ์ด: ป้าย AI แนะนำ + กรอบ, คุ้มค่าที่สุด/สเปกสูงสุดจาก AI, ราคาถูกสุดจากราคาจริง; คอลัมน์ที่แนะนำพื้นเหลือง', async () => {
    await open();
    const cards = all('.card');
    expect(cards[1].classList).toContain('recommended');
    expect(cards[1].querySelector('.ai-badge')?.textContent).toContain('AI แนะนำ');
    expect(cards[0].querySelector('.ai-badge')).toBeNull();
    expect(Array.from(cards[0].querySelectorAll('.tag')).map(t => t.textContent)).toEqual(['คุ้มค่าที่สุด', 'ราคาถูกสุด']);
    expect(Array.from(cards[1].querySelectorAll('.tag')).map(t => t.textContent)).toEqual(['สเปกสูงสุด']);
    expect(text('.card .price')).toBe('฿14,800');
    const vram = el.querySelector('tr[data-key="vram"]')!;
    expect(vram.querySelectorAll('td')[1].classList).toContain('rec');
    expect(vram.querySelectorAll('td')[0].classList).not.toContain('rec');
  });

  it('ตาราง: ราคาแถวเดียว ไม่มีแถว "สเปกเต็ม"/"สเปก #1", ค่าดีสุดพื้นเขียว, ไม่มีค่า = "ไม่มีข้อมูล"', async () => {
    await open();
    const labels = all('tbody th.label').map(th => th.textContent!.replace('expand_more', '').trim());
    expect(labels).toEqual(['ราคา', 'แบรนด์', 'หมวดหมู่', 'หน่วยความจำ', 'พอร์ตจอ', 'รายละเอียดเพิ่มเติม']);
    expect(labels.join()).not.toContain('สเปก #');
    const vram = el.querySelector('tr[data-key="vram"]')!.querySelectorAll('td');
    expect(vram[1].classList).toContain('best');
    expect(vram[0].classList).not.toContain('best');
    expect(el.querySelector('tr[data-key="price"]')!.querySelectorAll('td')[0].classList).toContain('best');
    expect(el.querySelector('tr[data-key="ports"]')!.querySelectorAll('td')[1].textContent!.trim()).toBe('ไม่มีข้อมูล');
  });

  it('"แสดงเฉพาะที่ต่างกัน" ซ่อนแถวที่ค่าเหมือนกัน; รายละเอียดเพิ่มเติมยุบไว้ก่อน กดแล้วแสดงสเปกเต็ม', async () => {
    await open();
    click(el.querySelector('.toggle input'));
    harness.detectChanges();
    expect(el.querySelector('tr[data-key="category"]')).toBeNull();
    expect(el.querySelector('tr[data-key="vram"]')).not.toBeNull();
    expect(text('.hidden-note')).toBe('ซ่อน 1 หัวข้อที่ค่าเหมือนกัน');

    expect(el.querySelector('td.details')).toBeNull();
    const btn = el.querySelector<HTMLButtonElement>('.details-btn')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    harness.detectChanges();
    expect(all('td.details').map(td => td.textContent!.trim())).toEqual(['สเปกเต็ม A', 'สเปกเต็ม B']);
  });

  it('ระหว่างรอ AI: "AI กำลังวิเคราะห์..." + skeleton แต่ตารางแสดงแล้ว', async () => {
    recommend.compareAnalysis.and.returnValue(new Subject<CompareAnalysis>().asObservable());
    await open();
    expect(text('.loading-text')).toBe('AI กำลังวิเคราะห์...');
    expect(el.querySelector('.skeleton')).not.toBeNull();
    expect(el.querySelector('tr[data-key="vram"]')).not.toBeNull();
  });

  it('AI ล้ม: "วิเคราะห์ไม่สำเร็จ" + ลองใหม่ (ตารางยังอยู่) — ลองใหม่สำเร็จแสดงผล', async () => {
    recommend.compareAnalysis.and.returnValue(throwError(() => new HttpErrorResponse({ status: 502 })));
    await open();
    expect(text('.failed p')).toBe('วิเคราะห์ไม่สำเร็จ');
    expect(el.querySelector('tr[data-key="vram"]')).not.toBeNull();
    expect(el.querySelector('.card.recommended')).toBeNull();

    recommend.compareAnalysis.and.returnValue(of(ANALYSIS));
    click(el.querySelector('.retry'));
    harness.detectChanges();
    expect(recommend.compareAnalysis.calls.mostRecent().args).toEqual([[1, 2], false]);
    expect(text('.overview')).toBe('ภาพรวมจาก AI');
  });

  it('"วิเคราะห์ใหม่" ข้ามผลที่เก็บไว้ (refresh=true)', async () => {
    await open();
    click(el.querySelector('.again'));
    harness.detectChanges();
    expect(recommend.compareAnalysis.calls.mostRecent().args).toEqual([[1, 2], true]);
  });

  it('สินค้าต่างประเภท: แจ้งว่าเทียบตรง ๆ ไม่ได้ ไม่มีป้าย AI แนะนำ', async () => {
    recommend.compareAnalysis.and.returnValue(of({
      ...ANALYSIS, sameKind: false, recommendation: null, scenarios: [], bestValueId: null, topSpecId: null,
      overview: 'สินค้าต่างประเภทกัน'
    }));
    await open();
    expect(text('.kind-note')).toContain('สินค้าต่างประเภทกัน จึงเปรียบเทียบกันตรง ๆ ไม่ได้');
    expect(el.querySelector('.pick')).toBeNull();
    expect(el.querySelector('.ai-badge')).toBeNull();
    expect(all('.product').length).toBe(2);
  });

  it('ถามเพิ่ม: ปุ่มคำถามแนะนำ 3 ปุ่ม คำตอบเป็นฟองใต้ช่องพิมพ์; พิมพ์แล้ว Enter ส่ง', async () => {
    const answer = new Subject<{ answer: string }>();
    recommend.compareAsk.and.returnValue(answer.asObservable());
    await open();
    expect(el.querySelector('textarea')!.getAttribute('placeholder')).toBe('ถามเพิ่มเกี่ยวกับสินค้าชุดนี้ เช่น ตัวไหนเหมาะกับตัดต่อวิดีโอ');
    expect(all('.chip').map(c => c.textContent!.trim())).toEqual(['ตัวไหนคุ้มที่สุด', 'ตัวไหนเหมาะกับเล่นเกม', 'ต่างกันคุ้มกับราคาไหม']);

    click(all('.chip')[0]);
    harness.detectChanges();
    expect(recommend.compareAsk).toHaveBeenCalledOnceWith([1, 2], 'ตัวไหนคุ้มที่สุด');
    expect(all('.typing .dot').length).toBe(3);
    answer.next({ answer: 'GALAX RTX 5060 ราคาถูกกว่า' });
    answer.complete();
    harness.detectChanges();
    expect(all('.messages .bubble').map(b => b.textContent!.replace(/\s+/g, ' ').trim()))
      .toEqual(['คุณ: ตัวไหนคุ้มที่สุด', 'AI: GALAX RTX 5060 ราคาถูกกว่า']);

    recommend.compareAsk.and.returnValue(of({ answer: 'ไม่มีข้อมูลน้ำหนัก' }));
    const box = el.querySelector('textarea')!;
    box.value = 'ตัวไหนเบากว่า';
    box.dispatchEvent(new Event('input'));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    harness.detectChanges();
    expect(recommend.compareAsk.calls.mostRecent().args).toEqual([[1, 2], 'ตัวไหนเบากว่า']);
    expect(text('.messages .msg:last-child .bubble')).toBe('AI: ไม่มีข้อมูลน้ำหนัก');
  });

  it('X บนการ์ด: เอาออกจาก ?ids= และจากแถบเปรียบเทียบ (ถ้ามี)', async () => {
    const compare = TestBed.inject(CompareService);
    compare.toggle(product(1, 'GALAX RTX 5060'));
    compare.toggle(product(2, 'XYZ RX 9060 XT'));
    await open('/recommendations?ids=1,2,3');
    click(all('.remove')[0]);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/recommendations?ids=2,3');
    expect(compare.isInCompare(1)).toBeFalse();
    expect(compare.isInCompare(2)).toBeTrue();
    compare.clear();
  });
});

describe('ComparePageComponent: โควตา guest', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let recommend: jasmine.SpyObj<RecommendService>;
  let authModal: jasmine.SpyObj<AuthModalService>;

  beforeEach(async () => {
    localStorage.setItem(GUEST_QUOTA_KEY, '4'); // เหลือ 1 ครั้ง
    const products = jasmine.createSpyObj<ProductService>('ProductService', ['compareTable']);
    products.compareTable.and.returnValue(of(TABLE));
    recommend = jasmine.createSpyObj<RecommendService>('RecommendService', ['compareAnalysis', 'compareAsk', 'query', 'getAuto']);
    recommend.compareAnalysis.and.returnValue(of(ANALYSIS));
    recommend.compareAsk.and.returnValue(of({ answer: 'คำตอบ' }));
    authModal = jasmine.createSpyObj<AuthModalService>('AuthModalService', ['open']);
    const loggedIn$ = new BehaviorSubject(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'recommendations', component: RecommendationsComponent }]),
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ProductService, useValue: products },
        { provide: RecommendService, useValue: recommend },
        { provide: HistoryService, useValue: jasmine.createSpyObj<HistoryService>('HistoryService', ['recordCompare']) },
        { provide: AuthModalService, useValue: authModal },
        { provide: AuthService, useValue: { isLoggedIn: () => false, loggedIn$: loggedIn$.asObservable() } }
      ]
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/recommendations?ids=1,2');
    harness.detectChanges();
    el = harness.routeNativeElement!;
  });

  afterEach(() => localStorage.removeItem(GUEST_QUOTA_KEY));

  it('วิเคราะห์อัตโนมัติครั้งแรกไม่นับ; ถามเพิ่มนับ 1; หมดแล้วช่องพิมพ์ปิด กดคำถามแนะนำ/วิเคราะห์ใหม่ = popup ล็อกอิน', () => {
    expect(recommend.compareAnalysis).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(GUEST_QUOTA_KEY)).toBe('4');
    expect(el.querySelector('.ask .quota')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('เหลือ 1 จาก 5 ครั้ง · เข้าสู่ระบบเพื่อใช้งานไม่จำกัด');

    (el.querySelectorAll<HTMLButtonElement>('.chip')[1]).click();
    harness.detectChanges();
    expect(recommend.compareAsk).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(GUEST_QUOTA_KEY)).toBe('5');
    expect(el.querySelector('.ask .quota.out')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('ใช้ครบ 5 ครั้งแล้ว เข้าสู่ระบบเพื่อใช้งานต่อ');
    expect(el.querySelector<HTMLTextAreaElement>('.ask textarea')!.disabled).toBeTrue();

    (el.querySelectorAll<HTMLButtonElement>('.chip')[0]).click();
    (el.querySelector<HTMLButtonElement>('.again'))!.click();
    harness.detectChanges();
    expect(recommend.compareAsk).toHaveBeenCalledTimes(1);
    expect(recommend.compareAnalysis).toHaveBeenCalledTimes(1);
    expect(authModal.open).toHaveBeenCalledTimes(2);
  });
});
