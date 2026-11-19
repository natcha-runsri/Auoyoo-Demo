import { HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { categoryLabel } from '../config/category-labels';
import { FavoriteProduct, PageResponse, Product } from '../models/product';
import type { AuthResponse } from '../services/authen/auth.service';
import type { CurrentUser } from '../services/user-profile/user-profile.service';
import type { HistoryItem, HistorySummary, SavedChat, SavedChatMessage, Slice } from '../services/history/history.service';
import type { RecommendationCriteria, RecommendationResponse } from '../services/recommend/recommend.service';
import { autoRecommend, compareAnalysis, compareAnswer, compareTable, recommend } from './demo-ai';
import { DEMO_PRODUCTS, DemoProduct, demoCategoryTree, findDemoProduct, toProduct } from './demo-data';
import { readJson, removeKey, writeJson } from './demo-storage';

/**
 * "backend" ของเดโม: ดักทุก request ที่ขึ้นต้นด้วย /api แล้วตอบจากข้อมูลจำลอง — ไม่มี request ไปไหนจริง
 * ใช้เฉพาะ configuration "demo" (ผ่าน demo-mode.demo.ts) และต้องอยู่หลัง authInterceptor (ใช้ header Authorization ที่มันแนบ)
 */

export const DEMO_SITE_URL = 'https://natcha-runsri.github.io/Auoyoo-Demo';
export const DEMO_USERNAME = 'demo-user';

// ---------- state ----------

interface DemoSession { username: string; email: string }
interface FavoriteEntry { productId: number; savedAt: string }
interface StoredItem extends Omit<HistoryItem, 'time' | 'questionCount'> { chatKey?: string | null }
interface StoredChat { id: number; key: string; startedAt: string; updatedAt: string; messages: SavedChatMessage[] }

const KEYS = { session: 'session', favorites: 'favorites', history: 'history', chats: 'chats', seq: 'seq' } as const;

/** รูปโปรไฟล์ที่อัปโหลด: blob URL อยู่ในแท็บนี้เท่านั้น (ไม่บันทึกที่ไหน รีเฟรชแล้วหาย) */
let avatarPreview: string | null = null;
/** อีเมลใหม่ที่ขอรหัสไว้ (ขั้น /email/code -> /email/confirm) */
let pendingEmail: string | null = null;
/** ผลวิเคราะห์ที่เคยทำแล้ว (ใน memory) — ครั้งถัดไปตอบว่า cached */
const analyzedSets = new Set<string>();

const session = (): DemoSession | null => readJson<DemoSession | null>('session', KEYS.session, null);
const setSession = (s: DemoSession | null) => (s ? writeJson('session', KEYS.session, s) : removeKey('session', KEYS.session));
const favorites = (): FavoriteEntry[] => readJson<FavoriteEntry[]>('local', KEYS.favorites, []);
const history = (): StoredItem[] => readJson<StoredItem[]>('local', KEYS.history, []);
const chats = (): StoredChat[] => readJson<StoredChat[]>('local', KEYS.chats, []);

function nextId(): number {
  const id = readJson<number>('local', KEYS.seq, 1000) + 1;
  writeJson('local', KEYS.seq, id);
  return id;
}

// ---------- helpers ----------

class DemoHttpError {
  constructor(readonly status: number, readonly body: unknown) {}
}

function fail(status: number, message: string, code?: string): never {
  throw new DemoHttpError(status, { message, ...(code ? { code } : {}) });
}

/** JWT ปลอม (ไม่มีลายเซ็นจริง) — AuthService อ่านแค่ exp เพื่อตั้งเวลาต่ออายุ */
function fakeToken(): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'demo', exp, demo: true })}.demo`;
}

function authResponse(s: DemoSession): AuthResponse {
  return { token: fakeToken(), username: s.username, fullName: null };
}

function requireUser(authed: boolean): DemoSession {
  const s = session();
  if (!authed || !s) fail(401, 'กรุณาเข้าสู่ระบบ');
  return s;
}

function product(id: number): DemoProduct {
  const p = findDemoProduct(id);
  if (!p) fail(404, 'ไม่พบสินค้า');
  return p;
}

function productsByIds(raw: string | null): DemoProduct[] {
  const ids = (raw ?? '').split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0);
  return ids.map(id => findDemoProduct(id)).filter((p): p is DemoProduct => !!p);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** วันที่ตามเวลาในเครื่องผู้ใช้ "yyyy-MM-dd" */
function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function sessionFromLogin(nameOrEmail: string, email?: string): DemoSession {
  const raw = (nameOrEmail ?? '').trim() || DEMO_USERNAME;
  const username = raw.includes('@') ? raw.split('@')[0] || DEMO_USERNAME : raw;
  return { username, email: (email ?? '').trim() || (raw.includes('@') ? raw : `${username}@example.com`) };
}

function currentUser(s: DemoSession): CurrentUser {
  return { username: s.username, email: s.email, avatarUrl: avatarPreview, hasPassword: true };
}

// ---------- favorites ----------

function favoriteList(): FavoriteProduct[] {
  return [...favorites()]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .map(f => findDemoProduct(f.productId) ? { f, p: findDemoProduct(f.productId)! } : null)
    .filter((x): x is { f: FavoriteEntry; p: DemoProduct } => !!x)
    .map(({ f, p }) => ({
      ...toProduct(p), savedAt: f.savedAt,
      highlights: Object.entries(p.specs).slice(0, 3).map(([k, v]) => `${k} ${v}`)
    }));
}

// ---------- history ----------

function record(item: Omit<StoredItem, 'id' | 'createdAt'>): void {
  const list = history();
  list.push({ ...item, id: nextId(), createdAt: new Date().toISOString() });
  writeJson('local', KEYS.history, list.slice(-500));
}

function toItem(s: StoredItem, saved: StoredChat[]): HistoryItem {
  const { chatKey: _chatKey, ...rest } = s;
  const questionCount = s.chatId ? saved.find(c => c.id === s.chatId)?.messages.filter(m => m.role === 'user').length ?? 1 : null;
  return { ...rest, time: localTime(s.createdAt), questionCount };
}

/** เปอร์เซ็นต์จำนวนเต็มรวม 100 (largest remainder — กฎเดียวกับระบบจริง) */
function slices(entries: { key: string; label: string; count: number }[]): Slice[] {
  const total = entries.reduce((s, e) => s + e.count, 0);
  if (!total) return [];
  const raw = entries.map(e => (e.count * 100) / total);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - floors[i] })).sort((a, b) => b.rem - a.rem);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return entries.map((e, i) => ({ ...e, percent: floors[i] }));
}

const PRICE_RANGES = [
  { key: 'UNDER_10K', label: 'ต่ำกว่า 10,000', upTo: 10000 },
  { key: '10K_20K', label: '10,000–20,000', upTo: 20000 },
  { key: '20K_40K', label: '20,000–40,000', upTo: 40000 },
  { key: 'OVER_40K', label: 'มากกว่า 40,000', upTo: Infinity }
];

function summary(date: string, range: 7 | 30): HistorySummary {
  const from = addDays(date, -(range - 1));
  const items = history().filter(i => {
    const d = localDate(i.createdAt);
    return d >= from && d <= date;
  });
  const catCounts = new Map<string, number>();
  for (const i of items) if (i.category) catCounts.set(i.category, (catCounts.get(i.category) ?? 0) + 1);
  const sorted = [...catCounts.entries()].sort((a, b) => b[1] - a[1] || categoryLabel(a[0]).localeCompare(categoryLabel(b[0])));
  const top = sorted.slice(0, 4).map(([key, count]) => ({ key, label: categoryLabel(key), count }));
  const other = sorted.slice(4).reduce((s, [, c]) => s + c, 0);
  if (other) top.push({ key: 'OTHER', label: 'อื่น ๆ', count: other });

  const priceCounts = PRICE_RANGES.map(() => 0);
  for (const i of items) {
    const p = i.type === 'VIEW' && i.productId ? findDemoProduct(i.productId) : undefined;
    if (p) priceCounts[PRICE_RANGES.findIndex(r => p.price <= r.upTo)]++;
  }
  const priceEntries = PRICE_RANGES.map((r, i) => ({ key: r.key, label: r.label, count: priceCounts[i] })).filter(e => e.count > 0);
  const categories = slices(top);
  const priceRanges = slices(priceEntries);
  return {
    from, to: date, rangeDays: range,
    categoryTotal: top.reduce((s, e) => s + e.count, 0), categories,
    priceTotal: priceEntries.reduce((s, e) => s + e.count, 0), priceRanges
  };
}

/** ผู้ที่ล็อกอิน: เก็บบทสนทนากับ AI + รายการ "แชท AI" ในประวัติ (1 รายการต่อแชท) */
function saveChat(chatKey: string | null, question: string, res: RecommendationResponse): void {
  if (!chatKey) return;
  const now = new Date().toISOString();
  const all = chats();
  let chat = all.find(c => c.key === chatKey);
  if (!chat) {
    chat = { id: nextId(), key: chatKey, startedAt: now, updatedAt: now, messages: [] };
    all.push(chat);
    record({ type: 'SEARCH', source: 'AI', title: question, productId: null, category: res.criteria?.category ?? null, chatId: chat.id, chatKey });
  }
  chat.updatedAt = now;
  chat.messages.push({ role: 'user', text: question, products: [], createdAt: now });
  const botText = res.understood ? [res.message, res.narration].filter(Boolean).join('\n\n') : res.message;
  chat.messages.push({ role: 'bot', text: botText, products: res.products, createdAt: now });
  writeJson('local', KEYS.chats, all.slice(-50));
}

// ---------- router ----------

interface Ctx {
  method: string;
  path: string;
  params: HttpParams;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  authed: boolean;
}

/** ตอบ request — คืน [status, body] หรือโยน DemoHttpError */
function handle(c: Ctx): [number, unknown] {
  const { method, path, params, body } = c;
  const seg = path.split('/').filter(Boolean);
  const is = (m: string, p: string) => method === m && path === p;

  // ----- site config -----
  if (is('GET', '/site-config')) {
    return [200, { siteUrl: DEMO_SITE_URL, contactEmail: '', googleClientId: '' }];
  }

  // ----- auth -----
  if (is('POST', '/auth/login')) {
    const s = sessionFromLogin(body?.username);
    setSession(s);
    return [200, authResponse(s)];
  }
  if (is('POST', '/auth/register')) {
    const s = sessionFromLogin(body?.username, body?.email);
    setSession(s);
    return [200, authResponse(s)];
  }
  if (is('POST', '/auth/google')) fail(400, 'เดโมนี้ไม่รองรับการเข้าสู่ระบบด้วย Google');
  if (is('POST', '/auth/refresh')) {
    const s = session();
    if (!s) fail(401, 'ไม่มี session');
    return [200, authResponse(s)];
  }
  if (is('POST', '/auth/logout')) {
    setSession(null);
    avatarPreview = null;
    return [204, null];
  }
  if (is('POST', '/auth/forgot-password')) {
    return [200, { message: 'ส่งรหัสยืนยันแล้ว (เดโม: ไม่มีอีเมลจริง ใส่รหัส 6 หลักอะไรก็ได้)', expiresInSeconds: 600, resendAfterSeconds: 30 }];
  }
  if (is('POST', '/auth/verify-reset-code')) {
    return [200, { resetToken: 'demo-reset-token', expiresInSeconds: 600 }];
  }
  if (is('POST', '/auth/reset-password')) {
    return [200, { message: 'ตั้งรหัสผ่านใหม่เรียบร้อย (เดโม: ไม่ได้บันทึกจริง)', username: DEMO_USERNAME }];
  }

  // ----- categories -----
  if (is('GET', '/categories')) return [200, demoCategoryTree()];
  if (is('GET', '/categories/brands')) {
    const keys = (params.get('categoryKey') ?? '').split(',').map(k => k.trim()).filter(Boolean);
    const counts = new Map<string, number>();
    for (const p of DEMO_PRODUCTS) if (!keys.length || keys.includes(p.category)) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    return [200, [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([brand, count]) => ({ brand, count }))];
  }

  // ----- products -----
  if (is('GET', '/products')) {
    const cats = (params.get('category') ?? '').split(',').map(k => k.trim()).filter(Boolean);
    const brands = (params.getAll('brand') ?? []).map(b => b.toLowerCase());
    const min = params.has('minPrice') ? Number(params.get('minPrice')) : null;
    const max = params.has('maxPrice') ? Number(params.get('maxPrice')) : null;
    const words = (params.get('keyword') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const page = Math.max(0, Number(params.get('page') ?? 0));
    const size = Math.max(1, Number(params.get('size') ?? 9));
    const found = DEMO_PRODUCTS.filter(p =>
      (!cats.length || cats.includes(p.category))
      && (!brands.length || brands.includes(p.brand.toLowerCase()))
      && (min == null || p.price >= min) && (max == null || p.price <= max)
      && words.every(w => `${p.name} ${p.brand} ${categoryLabel(p.category)} ${p.category} ${Object.values(p.specs).join(' ')} ${p.tags.join(' ')}`
        .toLowerCase().includes(w)));
    const result: PageResponse<Product> = {
      content: found.slice(page * size, page * size + size).map(toProduct),
      totalElements: found.length, totalPages: Math.ceil(found.length / size), number: page, size
    };
    return [200, result];
  }
  if (is('GET', '/products/price-range')) {
    const cats = (params.get('category') ?? '').split(',').map(k => k.trim()).filter(Boolean);
    const prices = DEMO_PRODUCTS.filter(p => !cats.length || cats.includes(p.category)).map(p => p.price);
    return [200, prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: null, max: null }];
  }
  if (is('GET', '/products/compare')) return [200, productsByIds(params.get('ids')).map(toProduct)];
  if (is('GET', '/products/compare-table')) {
    const items = productsByIds(params.get('ids'));
    if (items.length < 2) fail(400, 'เลือกสินค้าอย่างน้อย 2 รายการ');
    return [200, compareTable(items)];
  }
  if (method === 'GET' && seg[0] === 'products' && seg.length === 2) {
    return [200, toProduct(product(Number(seg[1])))];
  }

  // ----- recommend (ไม่ใช้โมเดลภาษา) -----
  if (is('POST', '/recommend/query')) {
    const message = String(body?.message ?? '').trim();
    if (!message) fail(400, 'กรุณาพิมพ์ข้อความ');
    const res = recommend(message, (body?.context ?? null) as RecommendationCriteria | null);
    if (c.authed && session()) saveChat(body?.chatId ?? null, message, res);
    return [200, res];
  }
  if (is('GET', '/recommend/auto')) {
    const recent = c.authed ? history().filter(i => i.type === 'VIEW' && i.category).map(i => i.category!) : [];
    const res = autoRecommend(recent);
    if (c.authed && session()) saveChat(params.get('chatId'), 'แนะนำอัตโนมัติ', res);
    return [200, res];
  }
  if (is('POST', '/recommend/compare-analysis')) {
    const items = productsByIds((body?.ids ?? []).join(','));
    if (items.length < 2) fail(400, 'เลือกสินค้าอย่างน้อย 2 รายการ');
    const key = items.map(p => p.id).sort((a, b) => a - b).join(',');
    const cached = !body?.refresh && analyzedSets.has(key);
    analyzedSets.add(key);
    return [200, compareAnalysis(items, cached)];
  }
  if (is('POST', '/recommend/compare-ask')) {
    const items = productsByIds((body?.ids ?? []).join(','));
    const question = String(body?.question ?? '').trim();
    if (items.length < 2 || !question) fail(400, 'กรุณาพิมพ์คำถาม');
    return [200, { answer: compareAnswer(items, question) }];
  }

  // ----- favorites (ต้องล็อกอิน) -----
  if (seg[0] === 'favorites') {
    requireUser(c.authed);
    if (is('GET', '/favorites')) return [200, favoriteList()];
    if (is('POST', '/favorites')) {
      const p = product(Number(body?.productId));
      const list = favorites().filter(f => f.productId !== p.id);
      list.push({ productId: p.id, savedAt: body?.savedAt || new Date().toISOString() });
      writeJson('local', KEYS.favorites, list);
      return [200, favoriteList()];
    }
    if (method === 'DELETE' && seg.length === 2) {
      writeJson('local', KEYS.favorites, favorites().filter(f => f.productId !== Number(seg[1])));
      return [200, favoriteList()];
    }
  }

  // ----- history (ต้องล็อกอิน) -----
  if (seg[0] === 'history') {
    requireUser(c.authed);
    if (is('GET', '/history')) {
      const date = params.get('date') ?? localDate(new Date().toISOString());
      const saved = chats();
      const items = history().filter(i => localDate(i.createdAt) === date)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(i => toItem(i, saved));
      return [200, { date, items }];
    }
    if (is('GET', '/history/days')) {
      const month = params.get('month') ?? '';
      return [200, [...new Set(history().map(i => localDate(i.createdAt)).filter(d => d.startsWith(month)))].sort()];
    }
    if (is('GET', '/history/summary')) {
      const range = Number(params.get('range')) === 30 ? 30 : 7;
      return [200, summary(params.get('date') ?? localDate(new Date().toISOString()), range)];
    }
    if (method === 'GET' && seg[1] === 'chats' && seg.length === 3) {
      const chat = chats().find(x => x.id === Number(seg[2]));
      if (!chat) fail(404, 'ไม่พบแชทนี้');
      const saved: SavedChat = { id: chat.id, startedAt: chat.startedAt, updatedAt: chat.updatedAt, messages: chat.messages };
      return [200, saved];
    }
    if (is('POST', '/history/views')) {
      const p = product(Number(body?.productId));
      record({ type: 'VIEW', source: 'PRODUCT', title: p.name, productId: p.id, category: p.category });
      return [204, null];
    }
    if (is('POST', '/history/searches')) {
      const query = String(body?.query ?? '').trim();
      if (query) record({ type: 'SEARCH', source: 'CATEGORY', title: query, productId: null, category: null });
      return [204, null];
    }
    if (is('POST', '/history/compares')) {
      const items = productsByIds((body?.productIds ?? []).join(','));
      const ids = items.map(p => p.id);
      // ชุดเดิมภายใน 30 นาทีไม่บันทึกซ้ำ (เหมือนระบบจริง)
      const recent = history().some(i => i.source === 'COMPARE' && (i.compareIds ?? []).join(',') === ids.join(',')
        && Date.now() - Date.parse(i.createdAt) < 30 * 60_000);
      if (items.length >= 2 && !recent) {
        const cats = [...new Set(items.map(p => p.category))];
        record({
          type: 'SEARCH', source: 'COMPARE', title: `เปรียบเทียบ ${items.length} รายการ`, productId: null,
          category: cats.length === 1 ? cats[0] : null, compareIds: ids, detail: items.map(p => p.name).join(' / ')
        });
      }
      return [204, null];
    }
    if (is('DELETE', '/history')) {
      writeJson('local', KEYS.history, []);
      writeJson('local', KEYS.chats, []);
      return [204, null];
    }
    if (method === 'DELETE' && seg.length === 2) {
      writeJson('local', KEYS.history, history().filter(i => i.id !== Number(seg[1])));
      return [204, null];
    }
  }

  // ----- users/me (ต้องล็อกอิน) -----
  if (seg[0] === 'users' && seg[1] === 'me') {
    const s = requireUser(c.authed);
    const sub = '/' + seg.slice(2).join('/');
    const codeSent = (to: string) => ({ sentTo: to, expiresInSeconds: 600, resendAfterSeconds: 30 });
    const step = { token: 'demo-step-token', expiresInSeconds: 600 };
    if (method === 'GET' && sub === '/') return [200, currentUser(s)];
    if (method === 'POST' && sub === '/avatar') {
      const file = body instanceof FormData ? body.get('file') : null;
      if (!(file instanceof Blob)) fail(400, 'ไม่พบไฟล์รูป');
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      avatarPreview = URL.createObjectURL(file);
      return [200, { avatarUrl: avatarPreview }];
    }
    if (method === 'PATCH' && sub === '/username') {
      const username = String(body?.username ?? '').trim();
      if (!username) fail(400, 'กรุณากรอกชื่อผู้ใช้');
      const next = { ...s, username };
      setSession(next);
      return [200, currentUser(next)];
    }
    if (method === 'POST') {
      switch (sub) {
        case '/password-confirm': return [200, step];
        case '/email/code':
          pendingEmail = String(body?.newEmail ?? '').trim() || s.email;
          return [200, codeSent(pendingEmail)];
        case '/email/confirm': {
          const email = pendingEmail ?? s.email;
          pendingEmail = null;
          setSession({ ...s, email });
          return [200, { email }];
        }
        case '/delete/code': return [200, codeSent(s.email)];
        case '/delete':
          for (const k of [KEYS.favorites, KEYS.history, KEYS.chats]) removeKey('local', k);
          setSession(null);
          avatarPreview = null;
          return [204, null];
        case '/password/code': return [200, codeSent(s.email)];
        case '/password/verify': return [200, step];
        case '/password': return [200, authResponse(s)];
      }
    }
  }

  fail(404, `เดโมไม่มี endpoint ${method} /api${path}`);
}

/** เวลาตอบจำลอง (ms) — AI ช้ากว่าเล็กน้อยให้เห็นสถานะกำลังโหลด */
function latency(path: string): number {
  return path.startsWith('/recommend') ? 700 : 120;
}

export const demoBackendInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next) => {
  const base = environment.apiUrl;
  if (req.url !== base && !req.url.startsWith(base + '/')) {
    return next(req);
  }
  const path = req.url.slice(base.length).split('?')[0] || '/';
  const ctx: Ctx = {
    method: req.method.toUpperCase(), path, params: req.params, body: req.body,
    authed: req.headers.has('Authorization') && !!session()
  };
  let response: Observable<HttpResponse<unknown>>;
  try {
    const [status, body] = handle(ctx);
    response = timer(latency(path)).pipe(mergeMap(() => of(new HttpResponse({ status, body, url: req.url }))));
  } catch (err) {
    const e = err instanceof DemoHttpError ? err : new DemoHttpError(500, { message: 'เดโมเกิดข้อผิดพลาด' });
    response = timer(latency(path)).pipe(mergeMap(() =>
      throwError(() => new HttpErrorResponse({ status: e.status, error: e.body, url: req.url, statusText: 'Demo' }))));
  }
  return response;
};
