import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { RecommendationsComponent, newChatId } from './recommendations.component';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';

describe('RecommendationsComponent', () => {
  let component: RecommendationsComponent;
  let fixture: ComponentFixture<RecommendationsComponent>;

  beforeEach(async () => {
    localStorage.removeItem('aiGuestQuotaUsed');
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');

    await TestBed.configureTestingModule({
      imports: [RecommendationsComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecommendationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.removeItem('aiGuestQuotaUsed'));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('แป้นพิมพ์มือถือเปิด (ai-chat-panel แจ้ง) -> พับแถบหัวหน้า; ปิดแล้วกางกลับ', () => {
    const page = () => fixture.nativeElement.querySelector('.rec-page') as HTMLElement;
    expect(page().classList).toContain('rec-page--chat');
    expect(page().classList).not.toContain('kb-open');

    fixture.debugElement.query(el => el.name === 'app-ai-chat-panel').triggerEventHandler('keyboardChange', true);
    fixture.detectChanges();
    expect(page().classList).toContain('kb-open');

    fixture.debugElement.query(el => el.name === 'app-ai-chat-panel').triggerEventHandler('keyboardChange', false);
    fixture.detectChanges();
    expect(page().classList).not.toContain('kb-open');
  });

  it('opens the login modal when a guest has used up the free quota', () => {
    const authModal = TestBed.inject(AuthModalService);
    spyOn(authModal, 'open');
    component.guestRemaining = 0;
    component.chatInput = 'โน้ตบุ๊ค งบ 20000';

    component.sendQuery();

    expect(authModal.open).toHaveBeenCalledWith('login', jasmine.objectContaining({ reason: jasmine.any(String) }));
    expect(component.chatLoading).toBeFalse();
  });

  it('shows the backend 429 message in the chat and stops loading', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    component.chatInput = 'โน้ตบุ๊ค งบ 20000';

    component.sendQuery();
    expect(component.chatLoading).toBeTrue();
    httpMock.expectOne(req => req.url.endsWith('/recommend/query')).flush(
      { message: 'ใช้งาน AI แนะนำสินค้าบ่อยเกินไป กรุณาลองใหม่ในอีกประมาณ 30 นาที' },
      { status: 429, statusText: 'Too Many Requests' });

    expect(component.chatLoading).toBeFalse();
    expect(component.chatMessages[component.chatMessages.length - 1].text)
      .toBe('ใช้งาน AI แนะนำสินค้าบ่อยเกินไป กรุณาลองใหม่ในอีกประมาณ 30 นาที');
    expect(component.guestRemaining).toBe(component.guestQuotaMax); // error ไม่นับโควตา guest
  });

  it('shows the backend notice before the AI narration', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    component.chatInput = 'โน้ตบุ๊ค Apple';

    component.sendQuery();
    httpMock.expectOne(req => req.url.endsWith('/recommend/query')).flush({
      understood: true, reason: 'หมวด Notebook', products: [],
      message: 'ไม่พบแบรนด์ Apple ในระบบ จึงแสดงสินค้าแบรนด์อื่นให้แทน',
      narration: 'คำอธิบายจาก AI'
    });

    expect(component.chatMessages[component.chatMessages.length - 1].text)
      .toBe('ไม่พบแบรนด์ Apple ในระบบ จึงแสดงสินค้าแบรนด์อื่นให้แทน\n\nคำอธิบายจาก AI');
  });

  // ---- แชทต่อเนื่อง: ส่ง criteria ของคำตอบก่อนหน้ากลับไปเป็น context ----

  const headphoneCriteria = { category: 'Headphone', minPrice: null, maxPrice: null, brand: null };

  function ask(text: string) {
    const httpMock = TestBed.inject(HttpTestingController);
    component.chatInput = text;
    component.sendQuery();
    return httpMock.expectOne(req => req.url.endsWith('/recommend/query'));
  }

  function answered(criteria: unknown, understood = true) {
    return { understood, reason: null, message: null, narration: 'คำอธิบาย', products: [], criteria };
  }

  it('sends no context on the first message of a chat', () => {
    const req = ask('ช่วยแนะนำหูฟังที่น่าใช้หน่อย');

    expect(req.request.body).toEqual({ message: 'ช่วยแนะนำหูฟังที่น่าใช้หน่อย', context: null, chatId: jasmine.any(String) });
  });

  it('sends the previous criteria as context on the follow-up message', () => {
    ask('ช่วยแนะนำหูฟังที่น่าใช้หน่อย').flush(answered(headphoneCriteria));

    const followUp = ask('ของบไม่เกิน 2000 สเปคดีๆ');

    expect(followUp.request.body).toEqual({ message: 'ของบไม่เกิน 2000 สเปคดีๆ', context: headphoneCriteria, chatId: jasmine.any(String) });
  });

  it('keeps the previous context when the backend asks back instead of searching', () => {
    ask('แนะนำหูฟังหน่อย').flush(answered(headphoneCriteria));
    ask('ขอถูกกว่านี้').flush({ ...answered(null, false), message: 'กรุณาระบุงบเป็นตัวเลข' });

    const next = ask('งบไม่เกิน 1500');

    expect(next.request.body.context).toEqual(headphoneCriteria);
  });

  it('replaces the context with the newest criteria from the backend', () => {
    const mouse = { category: 'Mouse', minPrice: null, maxPrice: 1000, brand: null };
    ask('แนะนำหูฟังหน่อย').flush(answered(headphoneCriteria));
    ask('เปลี่ยนเป็นเมาส์ งบไม่เกิน 1000').flush(answered(mouse));

    expect(ask('ขอแบบไร้สาย').request.body.context).toEqual(mouse);
  });

  it('sends the persona back as part of the context on the next message', () => {
    const notebookOffice = { category: 'Notebook', minPrice: null, maxPrice: null, brand: null, persona: 'OFFICE_WORKER' };
    ask('แนะนำโน้ตบุ๊ก').flush(answered({ ...notebookOffice, persona: null }));
    ask('แล้วแบบสำหรับคนทำงานละ').flush(answered(notebookOffice));

    expect(ask('งบ 30000').request.body.context).toEqual(notebookOffice);
  });

  it('keeps the persona context when the backend asks the user to choose between personas', () => {
    const notebookProgrammer = { category: 'Notebook', minPrice: null, maxPrice: null, brand: null, persona: 'PROGRAMMER' };
    ask('โน้ตบุ๊กสำหรับโปรแกรมเมอร์').flush(answered(notebookProgrammer));
    ask('ทำคอนเทนต์และตัดต่อคลิป').flush({
      ...answered(null, false),
      message: 'ข้อความนี้มีหลายการใช้งาน (นักตัดต่อวิดีโอ, Influencer/Content Creator) ต้องการให้แนะนำสำหรับแบบไหนเป็นหลักครับ'
    });

    expect(component.chatMessages[component.chatMessages.length - 1].text).toContain('ข้อความนี้มีหลายการใช้งาน');
    expect(ask('นักตัดต่อ').request.body.context).toEqual(notebookProgrammer);
  });

  it('new chat clears the persona together with the rest of the context', () => {
    ask('โน้ตบุ๊กสำหรับนักตัดต่อ').flush(answered(
      { category: 'Notebook', minPrice: null, maxPrice: null, brand: null, persona: 'VIDEO_EDITOR' }));

    component.newChat();

    expect(ask('แนะนำหูฟัง').request.body.context).toBeNull();
  });

  it('new chat clears messages and context', () => {
    ask('แนะนำหูฟังหน่อย').flush(answered(headphoneCriteria));

    component.newChat();

    expect(component.chatMessages.length).toBe(1); // เหลือแค่ข้อความทักทายของบอท
    expect(ask('งบไม่เกิน 2000').request.body.context).toBeNull();
  });

  it('new chat is ignored while a request is still loading', () => {
    ask('แนะนำหูฟังหน่อย');
    const before = component.chatMessages.length;

    component.newChat();

    expect(component.chatMessages.length).toBe(before);
  });

  it('auto recommend clears the context', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    ask('แนะนำหูฟังหน่อย').flush(answered(headphoneCriteria));

    component.autoRecommend();
    httpMock.expectOne(req => req.url.endsWith('/recommend/auto')).flush(answered(null));

    expect(ask('งบไม่เกิน 2000').request.body.context).toBeNull();
  });

  // ---- รหัสแชท: backend ใช้เก็บบทสนทนาไว้อ่านย้อนหลังที่หน้าประวัติ ----

  it('sends the same chat id for every message of one chat, and a new one after "new chat"', () => {
    const first = ask('แนะนำหูฟังหน่อย');
    const chatId = first.request.body.chatId as string;
    expect(chatId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    first.flush(answered(headphoneCriteria));

    const second = ask('งบไม่เกิน 2000');
    expect(second.request.body.chatId).toBe(chatId);
    second.flush(answered(headphoneCriteria));

    component.newChat();
    expect(ask('แนะนำเมาส์').request.body.chatId).not.toBe(chatId);
  });

  it('auto recommend sends the chat id of the current chat', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const first = ask('แนะนำหูฟังหน่อย');
    const chatId = first.request.body.chatId;
    first.flush(answered(headphoneCriteria));

    component.autoRecommend();
    const auto = httpMock.expectOne(req => req.url.endsWith('/recommend/auto'));

    expect(auto.request.params.get('chatId')).toBe(chatId);
  });

  it('newChatId falls back to a valid UUID when crypto.randomUUID is unavailable', () => {
    // randomUUID อยู่ที่ Crypto.prototype — บังด้วย property ของ object ชั่วคราว แล้วลบออก
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
    const random = spyOn(Math, 'random').and.callThrough();
    const getRandomValues = spyOn(globalThis.crypto, 'getRandomValues').and.callThrough();
    try {
      expect(newChatId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(getRandomValues).toHaveBeenCalled(); // ตัวสุ่มของ Web Crypto ไม่ใช่ Math.random
      expect(random).not.toHaveBeenCalled();
      expect(newChatId()).not.toBe(newChatId());
    } finally {
      delete (globalThis.crypto as { randomUUID?: unknown }).randomUUID;
    }
  });

  it('shows a polite message on 503 without a body and stops loading', () => {
    const httpMock = TestBed.inject(HttpTestingController);

    component.autoRecommend();
    httpMock.expectOne(req => req.url.endsWith('/recommend/auto')).flush(
      null, { status: 503, statusText: 'Service Unavailable' });

    expect(component.chatLoading).toBeFalse();
    expect(component.chatMessages[component.chatMessages.length - 1].text)
      .toBe('บริการ AI ไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง');
  });
});
