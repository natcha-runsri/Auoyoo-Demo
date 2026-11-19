import { brandLabel, isKnownBrand } from './brand-label';

describe('brandLabel', () => {
  it('Unknown/ว่าง = "ไม่ระบุแบรนด์"; แบรนด์จริงแสดงตามเดิม', () => {
    expect(brandLabel('Unknown')).toBe('ไม่ระบุแบรนด์');
    expect(brandLabel(null)).toBe('ไม่ระบุแบรนด์');
    expect(brandLabel('  ')).toBe('ไม่ระบุแบรนด์');
    expect(brandLabel('GALAX')).toBe('GALAX');
    expect(isKnownBrand('unknown')).toBeFalse();
  });
});
