import { storeDisplayName, storeLinkLabel } from './stores';

describe('stores', () => {
  it('แปลง source เป็นชื่อร้านสมมติที่ชัดเจน', () => {
    expect(storeLinkLabel('demo-a')).toBe('ดูที่ร้าน ร้านตัวอย่าง A');
    expect(storeLinkLabel('DEMO-B')).toBe('ดูที่ร้าน ร้านตัวอย่าง B');
    expect(storeDisplayName(' demo-a ')).toBe('ร้านตัวอย่าง A');
  });

  it('ร้านที่ไม่รู้จัก -> ข้อความกลาง', () => {
    expect(storeDisplayName('unknown-shop')).toBeNull();
    expect(storeLinkLabel(undefined)).toBe('ดูที่ร้านค้าต้นทาง');
  });
});
