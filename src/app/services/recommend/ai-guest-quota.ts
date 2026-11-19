/**
 * โควตา AI ของผู้ที่ยังไม่ล็อกอิน — ใช้ร่วมกันระหว่างแชท AI แนะนำ และหน้าเปรียบเทียบ (ถามเพิ่ม / วิเคราะห์ใหม่)
 * เก็บใน localStorage ของเบราว์เซอร์ (อ่าน/เขียนไม่ได้ = ใช้ได้เหมือนยังไม่เคยใช้; backend มี rate limit อีกชั้น)
 */
export const GUEST_QUOTA_KEY = 'aiGuestQuotaUsed';
export const GUEST_QUOTA_MAX = 5;

export function readGuestUsed(): number {
  try {
    const raw = localStorage.getItem(GUEST_QUOTA_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function guestRemaining(): number {
  return Math.max(0, GUEST_QUOTA_MAX - readGuestUsed());
}

/** นับการใช้ 1 ครั้ง คืนจำนวนที่เหลือ */
export function recordGuestUse(): number {
  const used = readGuestUsed() + 1;
  try {
    localStorage.setItem(GUEST_QUOTA_KEY, String(used));
  } catch {
    /* storage เต็ม/ปิดใช้งาน — ปล่อยผ่าน */
  }
  return Math.max(0, GUEST_QUOTA_MAX - used);
}
