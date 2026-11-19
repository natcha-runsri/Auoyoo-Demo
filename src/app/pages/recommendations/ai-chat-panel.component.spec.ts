import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, of } from 'rxjs';

import {
  AiChatPanelComponent, CHAT_DOCK_BODY_CLASS, COMPACT_INPUT_QUERY, INPUT_PLACEHOLDER, INPUT_PLACEHOLDER_COMPACT, KEYBOARD_MIN_PX, NEAR_BOTTOM_PX
} from './ai-chat-panel.component';
import { ChatDockService } from '../../services/chat-dock/chat-dock.service';
import { RecommendationsComponent, ChatMessage } from './recommendations.component';
import { CurrentUser, UserProfileService } from '../../services/user-profile/user-profile.service';
import { RecommendService } from '../../services/recommend/recommend.service';
import { AuthService } from '../../services/authen/auth.service';

const GREETING: ChatMessage = { role: 'bot', text: 'สวัสดีครับ' };

describe('AiChatPanelComponent', () => {
  let fixture: ComponentFixture<AiChatPanelComponent>;
  let panel: AiChatPanelComponent;
  let el: HTMLElement;

  function render(inputs: Partial<Record<keyof AiChatPanelComponent, unknown>>): void {
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiChatPanelComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(AiChatPanelComponent);
    panel = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('ยังไม่เริ่มแชท: โลโก้ หัวข้อ คำอธิบาย ปุ่มแนะนำอัตโนมัติ และไม่มีฟองทักทายซ้ำ', () => {
    render({ messages: [GREETING], isLoggedIn: true });
    expect(el.querySelector('.logo-frame img')?.getAttribute('src')).toBe('images/logo.png');
    expect(el.querySelector('.welcome-title')?.textContent).toBe('คุณกำลังหาอุปกรณ์ที่ใช่อยู่หรอ??');
    expect(el.querySelector('.auto-btn')).not.toBeNull();
    expect(el.querySelector('.bubble')).toBeNull();
  });

  it('กำลังแชท: ฟองทักทาย + ข้อความผู้ใช้ใช้รูปโปรไฟล์ของผู้ใช้; รายการข้อความเป็น aria-live', () => {
    render({ messages: [GREETING, { role: 'user', text: 'โน้ตบุ๊ก' }], userAvatar: 'https://cdn.example.invalid/me.png', isLoggedIn: true });
    expect(el.querySelector('.welcome')).toBeNull();
    expect(el.querySelector('.messages')?.getAttribute('aria-live')).toBe('polite');
    expect(el.querySelector('.msg.user img')?.getAttribute('src')).toBe('https://cdn.example.invalid/me.png');
    expect(el.querySelector('.msg:not(.user) .avatar.bot')).not.toBeNull();
    render({ userAvatar: 'https://cdn.example.invalid/new.png' });
    expect(el.querySelector('.msg.user img')?.getAttribute('src')).toBe('https://cdn.example.invalid/new.png');
  });

  it('ระหว่าง AI ตอบ: จุด 3 จุด และส่งไม่ได้', () => {
    render({ messages: [GREETING, { role: 'user', text: 'x' }], loading: true, input: 'ข้อความ', isLoggedIn: true });
    expect(el.querySelectorAll('.typing .dot').length).toBe(3);
    expect((el.querySelector('.send') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่, ช่องว่างส่งไม่ได้; ปุ่มส่งมี aria-label', () => {
    let sent = 0;
    panel.send.subscribe(() => sent++);
    render({ messages: [GREETING], isLoggedIn: true, input: '   ' });
    const textarea = el.querySelector('textarea')!;
    const send = el.querySelector('.send') as HTMLButtonElement;
    expect(send.getAttribute('aria-label')).toBe('ส่งข้อความ');
    expect(send.disabled).toBeTrue();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(sent).toBe(0);

    render({ input: 'โน้ตบุ๊ก' });
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(sent).toBe(0);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    textarea.dispatchEvent(enter);
    expect(sent).toBe(1);
    expect(enter.defaultPrevented).toBeTrue();
  });

  it('guest เห็นโควตาที่เหลือ (เหลือ 1 = สีแดงเลือดหมู) และกด "เข้าสู่ระบบ" ได้', () => {
    let login = 0;
    panel.login.subscribe(() => login++);
    render({ messages: [GREETING], isLoggedIn: false, guestRemaining: 3, guestQuotaMax: 5 });
    expect(el.querySelector('.quota')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('เหลือ 3 จาก 5 ครั้ง · เข้าสู่ระบบเพื่อใช้งานไม่จำกัด');
    expect(el.querySelector('.quota strong')?.classList).not.toContain('low');
    render({ guestRemaining: 1 });
    expect(el.querySelector('.quota strong')?.classList).toContain('low');
    (el.querySelector('.quota .link') as HTMLButtonElement).click();
    expect(login).toBe(1);
  });

  it('ล็อกอินแล้วไม่เห็นข้อความโควตา', () => {
    render({ messages: [GREETING], isLoggedIn: true, guestRemaining: 0 });
    expect(el.querySelector('.quota')).toBeNull();
    expect((el.querySelector('textarea') as HTMLTextAreaElement).disabled).toBeFalse();
  });

  it('guest หมดโควตา: ช่องพิมพ์ ปุ่มส่ง และปุ่มแนะนำอัตโนมัติกดไม่ได้ พร้อมข้อความให้เข้าสู่ระบบ', () => {
    render({ messages: [GREETING], isLoggedIn: false, guestRemaining: 0, guestQuotaMax: 5, input: 'แท็บเล็ต' });
    expect((el.querySelector('textarea') as HTMLTextAreaElement).disabled).toBeTrue();
    expect((el.querySelector('.send') as HTMLButtonElement).disabled).toBeTrue();
    expect((el.querySelector('.auto-btn') as HTMLButtonElement).disabled).toBeTrue();
    expect(el.querySelector('.quota.out')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('ใช้ครบ 5 ครั้งแล้ว เข้าสู่ระบบเพื่อใช้งานต่อ');
  });

  it('ปุ่มส่ง: กดได้เมื่อมีข้อความ (ไม่จาง) จางเมื่อช่องว่างหรือ AI กำลังตอบ', () => {
    render({ messages: [GREETING], isLoggedIn: true, input: '' });
    const send = () => el.querySelector('.send') as HTMLButtonElement;
    expect(send().disabled).toBeTrue();
    render({ input: 'เมาส์ไร้สาย' });
    expect(send().disabled).toBeFalse();
    expect(getComputedStyle(send()).opacity).toBe('1');
    render({ loading: true });
    expect(send().disabled).toBeTrue();
  });

  it('เปิดหน้าแชท = ใส่ class บน <body> (ทั้งหน้าไม่เลื่อน + ซ่อน footer); ปิดแล้วถอดออก', () => {
    render({ messages: [GREETING] });
    expect(document.body.classList).toContain(CHAT_DOCK_BODY_CLASS);
    fixture.destroy();
    expect(document.body.classList).not.toContain(CHAT_DOCK_BODY_CLASS);
  });
});

/** แชทยาวกว่าจอ — เลื่อนเฉพาะรายการข้อความ (ตัว component เอง) หน้าเว็บไม่เลื่อน */
describe('AiChatPanelComponent: เลื่อนอัตโนมัติ + ปุ่มไปข้อความล่าสุด', () => {
  let fixture: ComponentFixture<AiChatPanelComponent>;
  let el: HTMLElement;
  let scrollTo: jasmine.Spy;

  const longChat = (n: number): ChatMessage[] => [GREETING,
    ...Array.from({ length: n }, (_, i) => ({ role: (i % 2 ? 'bot' : 'user') as ChatMessage['role'], text: `ข้อความที่ ${i + 1}\nบรรทัดสอง\nบรรทัดสาม` }))];

  function render(inputs: Partial<Record<keyof AiChatPanelComponent, unknown>>): void {
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  /** ผู้ใช้เลื่อนรายการข้อความขึ้นไปบนสุด (เลื่อนจริง แล้วแจ้ง scroll event) */
  function userScrollsToTop(): void {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    scrollTo.calls.reset();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiChatPanelComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(AiChatPanelComponent);
    el = fixture.nativeElement;
    document.body.appendChild(el); // ให้เนื้อหาสูงจริงในหน้า
    el.style.height = '400px'; // สูงเท่าพื้นที่ใต้ header ในหน้าจริง (แชทยาวกว่านี้จึงเลื่อนในกล่อง)
    scrollTo = spyOn(el, 'scrollTo').and.callThrough();
  });

  afterEach(() => {
    fixture.destroy();
    el.remove();
  });

  it('ข้อความใหม่ตอนอยู่ล่างสุด -> เลื่อนรายการข้อความลงล่างสุดเอง ไม่มีปุ่มไปข้อความล่าสุด (หน้าเว็บไม่เลื่อน)', () => {
    const windowScroll = spyOn(window, 'scrollTo');
    render({ messages: longChat(30), isLoggedIn: true });
    expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);
    expect(scrollTo).toHaveBeenCalledWith({ top: el.scrollHeight, behavior: 'auto' });
    expect(el.scrollTop + el.clientHeight).toBeGreaterThanOrEqual(el.scrollHeight - NEAR_BOTTOM_PX);
    expect(el.querySelector('.jump')).toBeNull();
    expect(windowScroll).not.toHaveBeenCalled();
  });

  it('เลื่อนขึ้นไปอ่านข้อความเก่า -> ข้อความใหม่ไม่ดึงลง แต่แสดงปุ่ม; กดปุ่มแล้วเลื่อนลงล่างสุดและปุ่มหาย', () => {
    render({ messages: longChat(30), isLoggedIn: true });
    userScrollsToTop();
    expect(el.querySelector('.jump')?.getAttribute('aria-label')).toBe('ไปข้อความล่าสุด');

    render({ messages: longChat(31) });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(el.scrollTop).toBe(0);

    (el.querySelector('.jump') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(scrollTo).toHaveBeenCalledWith(jasmine.objectContaining({ top: el.scrollHeight }));
    expect(el.querySelector('.jump')).toBeNull();
  });

  it('ส่งข้อความเองระหว่างเลื่อนขึ้นไปอ่าน -> ตามลงไปล่างสุดเมื่อข้อความใหม่เข้ามา', () => {
    let sent = 0;
    fixture.componentInstance.send.subscribe(() => sent++);
    render({ messages: longChat(30), isLoggedIn: true, input: 'ขอหูฟังเกมมิ่ง' });
    userScrollsToTop();

    (el.querySelector('.send') as HTMLButtonElement).click();
    render({ messages: [...longChat(30), { role: 'user', text: 'ขอหูฟังเกมมิ่ง' }], loading: true, input: '' });

    expect(sent).toBe(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: el.scrollHeight, behavior: 'auto' });
  });

  it('ยังไม่เริ่มแชท -> ไม่เลื่อนหน้า', () => {
    render({ messages: [GREETING], isLoggedIn: true });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('แถบเปรียบเทียบซ้อนเหนือช่องพิมพ์: แจ้งความสูงช่องพิมพ์ให้แถบ, ยกปุ่มไปข้อความล่าสุด + ที่ว่างท้ายหน้าตามความสูงแถบ', async () => {
    const dock = TestBed.inject(ChatDockService);
    render({ messages: longChat(30), isLoggedIn: true });
    expect(dock.active$.value).toBeTrue();
    await new Promise(r => setTimeout(r, 50)); // ResizeObserver ของช่องพิมพ์
    expect(dock.dockTop$.value).toBeGreaterThan(60);

    dock.compareBarHeight$.next(52);
    fixture.detectChanges();
    expect(el.style.getPropertyValue('--compare-stack')).toBe('62px');
    expect(document.body.style.getPropertyValue('--chat-dock-extra')).toBe('62px');
    userScrollsToTop();
    const jump = el.querySelector('.jump') as HTMLElement;
    const composer = el.querySelector('.composer') as HTMLElement;
    // ปุ่มอยู่เหนือแถบเปรียบเทียบ (สูงกว่าขอบบนช่องพิมพ์อย่างน้อยเท่าความสูงแถบ)
    expect(composer.getBoundingClientRect().top - jump.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(62);

    dock.compareBarHeight$.next(0);
    fixture.detectChanges();
    expect(document.body.style.getPropertyValue('--chat-dock-extra')).toBe('0px');

    fixture.destroy();
    expect(dock.active$.value).toBeFalse();
    expect(document.body.style.getPropertyValue('--chat-dock-extra')).toBe('');
  });
});

describe('RecommendationsComponent: รูปผู้ใช้ในแชท', () => {
  let user$: BehaviorSubject<CurrentUser | null>;

  beforeEach(async () => {
    user$ = new BehaviorSubject<CurrentUser | null>(null);
    const loggedIn$ = new BehaviorSubject(true);
    await TestBed.configureTestingModule({
      imports: [RecommendationsComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: UserProfileService, useValue: { currentUser$: user$.asObservable() } },
        { provide: AuthService, useValue: { isLoggedIn: () => true, loggedIn$: loggedIn$.asObservable() } },
        { provide: RecommendService, useValue: jasmine.createSpyObj('RecommendService', { query: of(), getAuto: of() }) }
      ]
    }).compileComponents();
  });

  it('ใช้รูปเดียวกับ navbar และเปลี่ยนตามทันที; ไม่มีรูป = รูปเริ่มต้น', () => {
    const fixture = TestBed.createComponent(RecommendationsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.userAvatar).toBe('images/default-avatar.svg');
    user$.next({ username: 'a', email: 'a@example.com', avatarUrl: 'https://cdn.example.invalid/a.png' });
    expect(component.userAvatar).toBe('https://cdn.example.invalid/a.png');
    user$.next({ username: 'a', email: 'a@example.com', avatarUrl: 'https://cdn.example.invalid/b.png' });
    expect(component.userAvatar).toBe('https://cdn.example.invalid/b.png');
    user$.next(null);
    expect(component.userAvatar).toBe('images/default-avatar.svg');
  });
});

/** แป้นพิมพ์มือถือ: ตรวจจาก visualViewport ตัวเดิม -> keyboardChange (หน้าแชทพับแถบหัวหน้า) */
describe('AiChatPanelComponent: ตรวจแป้นพิมพ์มือถือ', () => {
  let fixture: ComponentFixture<AiChatPanelComponent>;
  let el: HTMLElement;
  let events: boolean[];
  let vvHeight: number;
  let innerH: number;
  const vv = window.visualViewport!;
  const base = vv.height;

  /** จอเปลี่ยน -> ให้ visualViewport แจ้ง resize เหมือนบนมือถือ */
  function viewport(visual: number, layout: number): void {
    vvHeight = visual;
    innerH = layout;
    vv.dispatchEvent(new Event('resize'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiChatPanelComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    vvHeight = base;
    innerH = base;
    spyOnProperty(vv, 'height').and.callFake(() => vvHeight);
    spyOnProperty(vv, 'offsetTop').and.returnValue(0);
    spyOnProperty(window, 'innerHeight').and.callFake(() => innerH);
    fixture = TestBed.createComponent(AiChatPanelComponent);
    el = fixture.nativeElement;
    document.body.appendChild(el);
    events = [];
    fixture.componentInstance.keyboardChange.subscribe((open: boolean) => events.push(open));
    fixture.componentRef.setInput('messages', [GREETING]);
    fixture.componentRef.setInput('isLoggedIn', true); // guest โควตาหมด = ช่องพิมพ์ปิด โฟกัสไม่ได้
    fixture.detectChanges();
    (el.querySelector('textarea') as HTMLTextAreaElement).focus();
    expect(document.activeElement).toBe(el.querySelector('textarea'));
  });

  afterEach(() => {
    fixture.destroy();
    el.remove();
  });

  it('iOS: แป้นพิมพ์บังส่วนล่างของจอ (layout เท่าเดิม) -> เปิด แล้วยกช่องพิมพ์ขึ้น; ปิดแป้นพิมพ์ -> ปิด', () => {
    viewport(base - 300, base);
    fixture.detectChanges();
    expect(events).toEqual([true]);
    expect(el.style.getPropertyValue('--kb-offset')).toBe('300px');
    viewport(base, base);
    expect(events).toEqual([true, false]);
  });

  it('Android (resizes-content): ทั้งหน้าเตี้ยลง keyboardOffset = 0 แต่ยังนับว่าแป้นพิมพ์เปิด', () => {
    viewport(base - 300, base - 300);
    fixture.detectChanges();
    expect(events).toEqual([true]);
    expect(el.style.getPropertyValue('--kb-offset')).toBe('0px');
    viewport(base, base);
    expect(events).toEqual([true, false]);
  });

  it('จอเตี้ยลงนิดเดียว (แถบ address bar) หรือไม่ได้โฟกัสช่องพิมพ์ -> ไม่นับเป็นแป้นพิมพ์', () => {
    viewport(base - (KEYBOARD_MIN_PX - 1), base - (KEYBOARD_MIN_PX - 1));
    expect(events).toEqual([]);
    (document.activeElement as HTMLElement).blur();
    viewport(base - 300, base - 300);
    expect(events).toEqual([]);
  });
});

/** ช่องพิมพ์บนจอ < 600px: เริ่ม 1 บรรทัด placeholder สั้น ขยายได้ไม่เกิน 4 บรรทัด (จอใหญ่ 2 บรรทัด / 5 บรรทัดเหมือนเดิม) */
describe('AiChatPanelComponent: ช่องพิมพ์กะทัดรัดบนมือถือ', () => {
  const realMatchMedia = window.matchMedia.bind(window);

  function create(compact: boolean): { fixture: ComponentFixture<AiChatPanelComponent>; box: HTMLTextAreaElement } {
    spyOn(window, 'matchMedia').and.callFake((query: string) => query === COMPACT_INPUT_QUERY
      ? ({ matches: compact, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList)
      : realMatchMedia(query));
    const fixture = TestBed.createComponent(AiChatPanelComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('messages', [GREETING]);
    fixture.componentRef.setInput('isLoggedIn', true);
    fixture.detectChanges();
    return { fixture, box: fixture.nativeElement.querySelector('textarea') };
  }

  /** พิมพ์ n บรรทัด แล้วรอ autoGrow */
  async function type(fixture: ComponentFixture<AiChatPanelComponent>, box: HTMLTextAreaElement, lines: number): Promise<void> {
    box.value = Array.from({ length: lines }, (_, i) => `บรรทัด ${i + 1}`).join('\n');
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise(r => setTimeout(r));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiChatPanelComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('จอ < 600px: 1 บรรทัด, placeholder สั้น, ขยายตามข้อความได้ไม่เกิน 4 บรรทัด', async () => {
    const { fixture, box } = create(true);
    expect(box.rows).toBe(1);
    expect(box.placeholder).toBe(INPUT_PLACEHOLDER_COMPACT);
    const line = parseFloat(getComputedStyle(box).lineHeight);
    await type(fixture, box, 2);
    expect(box.getBoundingClientRect().height).toBeGreaterThan(line * 1.5);
    await type(fixture, box, 10);
    expect(parseFloat(box.style.height)).toBe(line * 4 + 4);
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  it('จอใหญ่: 2 บรรทัด, placeholder เต็ม, ขยายได้ไม่เกิน 5 บรรทัดเหมือนเดิม', async () => {
    const { fixture, box } = create(false);
    expect(box.rows).toBe(2);
    expect(box.placeholder).toBe(INPUT_PLACEHOLDER);
    await type(fixture, box, 10);
    expect(parseFloat(box.style.height)).toBe(parseFloat(getComputedStyle(box).lineHeight) * 5 + 4);
    fixture.destroy();
    fixture.nativeElement.remove();
  });
});
