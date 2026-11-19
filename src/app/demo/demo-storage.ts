/**
 * ที่เก็บข้อมูลของเดโม — ทุก key ขึ้นต้นด้วย "auoyoo-demo:" และทุกการอ่าน/เขียนครอบ try/catch
 * (private mode / บล็อก storage -> ใช้ค่าใน memory แทน เดโมยังใช้งานได้ แค่ไม่จำข้ามการรีเฟรช)
 *   - localStorage: รายการโปรด ประวัติ แชทที่บันทึก (อยู่ในเบราว์เซอร์นั้นเท่านั้น)
 *   - sessionStorage: session ผู้ใช้เดโม (ปิดแท็บ = ออกจากระบบ)
 */
export const DEMO_STORAGE_PREFIX = 'auoyoo-demo:';

const memory = new Map<string, string>();

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(kind: 'local' | 'session', key: string, fallback: T): T {
  const fullKey = DEMO_STORAGE_PREFIX + key;
  let raw: string | null = null;
  try {
    raw = storage(kind)?.getItem(fullKey) ?? null;
  } catch {
    raw = null;
  }
  raw ??= memory.get(kind + ':' + fullKey) ?? null;
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(kind: 'local' | 'session', key: string, value: unknown): void {
  const fullKey = DEMO_STORAGE_PREFIX + key;
  const raw = JSON.stringify(value);
  memory.set(kind + ':' + fullKey, raw);
  try {
    storage(kind)?.setItem(fullKey, raw);
  } catch {
    // storage เต็ม/ถูกบล็อก — เก็บใน memory อย่างเดียว
  }
}

export function removeKey(kind: 'local' | 'session', key: string): void {
  const fullKey = DEMO_STORAGE_PREFIX + key;
  memory.delete(kind + ':' + fullKey);
  try {
    storage(kind)?.removeItem(fullKey);
  } catch {
    // ไม่มีอะไรให้ลบ
  }
}
