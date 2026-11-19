import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { AppComponent } from '../../app.component';
import { RecommendationsComponent } from './recommendations.component';
import { RecommendService, RecommendationResponse } from '../../services/recommend/recommend.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';

@Component({ standalone: true, template: '<p class="home">home</p>' })
class HomeStubComponent {}

const ANSWER: RecommendationResponse = {
  understood: true, reason: 'หมวด Notebook', message: null, narration: 'คำอธิบายจาก AI', products: [],
  criteria: { category: 'Notebook', minPrice: null, maxPrice: 30000, brand: null }
} as RecommendationResponse;

/**
 * ช่องค้นหา navbar -> หน้าแชท AI แนะนำ แล้วส่งคำค้นเป็นข้อความในแชทอัตโนมัติ
 * RecommendService เป็น mock (ไม่เรียก AI/Ollama จริง) — แต่ละคำถามได้ Subject ไว้ตอบเองในเทสต์
 */
describe('Navbar search -> AI chat', () => {
  let fixture: ComponentFixture<AppComponent>;
  let router: Router;
  let recommend: jasmine.SpyObj<RecommendService>;
  let answers: Subject<RecommendationResponse>[];

  const navbarInput = () => fixture.debugElement.query(By.css('.search-box input')).nativeElement as HTMLInputElement;
  const chat = () => fixture.debugElement.query(By.directive(RecommendationsComponent))?.componentInstance as RecommendationsComponent | undefined;
  const userTexts = () => (chat()?.chatMessages ?? []).filter(m => m.role === 'user').map(m => m.text);

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function searchFromNavbar(text: string, how: 'enter' | 'button' = 'enter'): Promise<void> {
    const input = navbarInput();
    input.value = text;
    input.dispatchEvent(new Event('input'));
    if (how === 'enter') {
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    } else {
      (fixture.debugElement.query(By.css('.search-btn')).nativeElement as HTMLButtonElement).click();
    }
    await settle();
  }

  function answerLast(res: RecommendationResponse = ANSWER): void {
    const subject = answers[answers.length - 1];
    subject.next(res);
    subject.complete();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.removeItem('aiGuestQuotaUsed');
    answers = [];
    // compareAnalysis: หน้าเปรียบเทียบ (?ids=) เรียกผลวิเคราะห์เอง — ไม่ตอบในเทสต์นี้
    recommend = jasmine.createSpyObj<RecommendService>('RecommendService', ['query', 'getAuto', 'compareAnalysis']);
    recommend.compareAnalysis.and.returnValue(new Subject<never>().asObservable());
    recommend.query.and.callFake(() => {
      const subject = new Subject<RecommendationResponse>();
      answers.push(subject);
      return subject.asObservable();
    });
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: '', component: HomeStubComponent },
          { path: 'recommendations', component: RecommendationsComponent }
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RecommendService, useValue: recommend }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await settle();
  });

  afterEach(() => localStorage.removeItem('aiGuestQuotaUsed'));

  it('Enter ในช่องค้นหา -> ไปหน้าแชท คำค้นขึ้นเป็นข้อความผู้ใช้ AI เริ่มตอบทันที และล้างช่องค้นหา', async () => {
    await searchFromNavbar('  โน้ตบุ๊กเล่นเกม งบไม่เกิน 30,000 ');

    expect(chat()).toBeDefined();
    expect(chat()!.mode).toBe('empty');
    expect(userTexts()).toEqual(['โน้ตบุ๊กเล่นเกม งบไม่เกิน 30,000']);
    expect(recommend.query).toHaveBeenCalledOnceWith('โน้ตบุ๊กเล่นเกม งบไม่เกิน 30,000', null, jasmine.any(String));
    expect(chat()!.chatLoading).toBeTrue();
    expect(navbarInput().value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('ค้นหาอุปกรณ์ที่ตรงใจมากที่สุด');
    expect(fixture.nativeElement.textContent).not.toContain('stub');

    answerLast();
    expect(chat()!.chatMessages[chat()!.chatMessages.length - 1].text).toBe('คำอธิบายจาก AI');
  });

  it('ค้นจาก navbar แล้วเข้าหน้าแชท -> เลื่อนรายการข้อความไปข้อความล่าสุด (ทั้งตอนส่งและตอน AI ตอบ)', async () => {
    // ตัวที่เลื่อนคือ <app-ai-chat-panel> (หน้าเว็บไม่เลื่อน) — สร้างทีหลังตอนเข้าหน้าแชท จึงดักที่ prototype
    const scrollTo: jasmine.Spy = spyOn(HTMLElement.prototype, 'scrollTo');
    await searchFromNavbar('หูฟังเกมมิ่ง');
    expect(scrollTo).toHaveBeenCalledWith(jasmine.objectContaining({ behavior: 'auto' }));

    scrollTo.calls.reset();
    answerLast();
    await settle();
    expect(scrollTo).toHaveBeenCalledWith(jasmine.objectContaining({ behavior: 'auto' }));
  });

  it('กดไอคอนแว่นขยายก็ส่งเหมือนกัน', async () => {
    await searchFromNavbar('เมาส์ไร้สาย', 'button');
    expect(userTexts()).toEqual(['เมาส์ไร้สาย']);
    expect(recommend.query).toHaveBeenCalledTimes(1);
  });

  it('ลบ ?q= ออกจาก URL หลังส่ง -> รีเฟรชหน้าแชทแล้วไม่ส่งคำค้นเดิมซ้ำ', async () => {
    await searchFromNavbar('หูฟังตัดเสียง');
    expect(router.url).toBe('/recommendations');

    // จำลองรีเฟรช: สร้างหน้าแชทใหม่จาก URL ปัจจุบัน
    await router.navigateByUrl('/');
    await settle();
    await router.navigateByUrl(router.parseUrl('/recommendations'));
    await settle();
    expect(recommend.query).toHaveBeenCalledTimes(1);
    expect(userTexts()).toEqual([]);
  });

  it('อยู่หน้าแชทอยู่แล้ว ค้นจาก navbar อีก -> ต่อท้ายแชทเดิม ไม่ล้าง และส่ง context ของคำตอบก่อนหน้าไปด้วย', async () => {
    await searchFromNavbar('โน้ตบุ๊ก');
    answerLast();
    const before = chat()!;

    await searchFromNavbar('งบไม่เกิน 20000');

    expect(chat()).toBe(before);
    expect(userTexts()).toEqual(['โน้ตบุ๊ก', 'งบไม่เกิน 20000']);
    expect(recommend.query.calls.mostRecent().args).toEqual(['งบไม่เกิน 20000', ANSWER.criteria!, jasmine.any(String)]);
  });

  it('ค้นคำเดิมซ้ำจาก navbar ก็ถามใหม่ได้ (URL ไม่มี ?q= ค้างแล้ว)', async () => {
    await searchFromNavbar('คีย์บอร์ด');
    answerLast();
    await searchFromNavbar('คีย์บอร์ด');
    expect(recommend.query).toHaveBeenCalledTimes(2);
    expect(userTexts()).toEqual(['คีย์บอร์ด', 'คีย์บอร์ด']);
  });

  it('ค้นระหว่าง AI ยังตอบข้อความก่อนหน้าไม่เสร็จ -> รอคิว แล้วส่งต่อทันทีที่ตอบเสร็จ (ลำดับ ถาม-ตอบ-ถาม)', async () => {
    await searchFromNavbar('จอ 27 นิ้ว');
    await searchFromNavbar('จอ 144Hz');
    expect(recommend.query).toHaveBeenCalledTimes(1);

    answerLast();
    expect(recommend.query).toHaveBeenCalledTimes(2);
    expect(chat()!.chatMessages.slice(1).map(m => m.role)).toEqual(['user', 'bot', 'user']);
    expect(userTexts()).toEqual(['จอ 27 นิ้ว', 'จอ 144Hz']);
  });

  it('ช่องว่างหรือมีแต่เว้นวรรค -> ไม่ไปไหน ไม่ส่งอะไร', async () => {
    await searchFromNavbar('');
    await searchFromNavbar('    ');
    expect(router.url).toBe('/');
    expect(recommend.query).not.toHaveBeenCalled();
  });

  it('ลิงก์เดิม /recommendations?q=... (เช่น จากหน้าประวัติ) -> เปิดหน้าแชทแล้วถามคำนั้นครั้งเดียว ไม่มีหน้า stub', async () => {
    await router.navigateByUrl(`/recommendations?q=${encodeURIComponent('ลำโพงบลูทูธ')}`);
    await settle();
    expect(userTexts()).toEqual(['ลำโพงบลูทูธ']);
    expect(recommend.query).toHaveBeenCalledOnceWith('ลำโพงบลูทูธ', null, jasmine.any(String));
    expect(router.url).toBe('/recommendations');
    expect(fixture.nativeElement.textContent).not.toContain('ผลการค้นหา:');
  });

  it('?ids= (เปรียบเทียบ) ยังเป็นโหมดเปรียบเทียบเหมือนเดิม ไม่ถาม AI', async () => {
    await router.navigateByUrl('/recommendations?ids=1,2&q=x');
    await settle();
    expect(chat()!.mode).toBe('compare');
    expect(recommend.query).not.toHaveBeenCalled();
  });

  it('guest ใช้โควตาหมดแล้ว -> เปิด popup ล็อกอิน เก็บคำค้นไว้ในช่องพิมพ์ ไม่ส่ง', async () => {
    const authModal = TestBed.inject(AuthModalService);
    spyOn(authModal, 'open');
    localStorage.setItem('aiGuestQuotaUsed', '5');
    await searchFromNavbar('แท็บเล็ต');
    expect(recommend.query).not.toHaveBeenCalled();
    expect(authModal.open).toHaveBeenCalledWith('login', jasmine.objectContaining({ reason: jasmine.any(String) }));
    expect(chat()!.chatInput).toBe('แท็บเล็ต');
  });
});
