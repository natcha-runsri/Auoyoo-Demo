import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { PRIVACY_LAST_UPDATED, PrivacyPolicyComponent } from './privacy-policy.component';
import { routes } from '../../app.routes';
import { SiteConfigService } from '../../services/site-config/site-config.service';

describe('PrivacyPolicyComponent', () => {
  let fixture: ComponentFixture<PrivacyPolicyComponent>;
  let el: HTMLElement;

  const text = () => el.textContent!.replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPolicyComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(PrivacyPolicyComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('อยู่ที่ route /privacy และมี SEO ของตัวเอง', () => {
    const route = routes.find(r => r.path === 'privacy');
    expect(route?.component).toBe(PrivacyPolicyComponent);
    expect(route?.data?.['seo']?.title).toBe('นโยบายความเป็นส่วนตัว | AuoYoo');
  });

  it('มีหัวข้อครบตามที่ต้องการ และวันที่ปรับปรุงล่าสุด', () => {
    const headings = Array.from(el.querySelectorAll('h2')).map(h => h.textContent!.trim());
    expect(headings).toEqual([
      '1. ข้อมูลที่เราเก็บ',
      '2. วัตถุประสงค์ในการใช้ข้อมูล',
      '3. การเข้าสู่ระบบด้วย Google',
      '4. การเก็บรักษาและความปลอดภัย',
      '5. การเปิดเผยข้อมูลต่อบุคคลที่สาม',
      '6. Cookie และข้อมูลในเบราว์เซอร์',
      '7. สิทธิของคุณตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
      '8. ติดต่อเรา',
      'การเปลี่ยนแปลงนโยบาย'
    ]);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('นโยบายความเป็นส่วนตัว');
    expect(text()).toContain(`ปรับปรุงล่าสุด: ${PRIVACY_LAST_UPDATED}`);
  });

  it('กรอกรายละเอียดครบแล้ว — ไม่มี [ช่องว่าง] เหลือ', () => {
    expect(el.querySelector('.todo')).toBeNull();
    expect(text()).not.toMatch(/\[[^\]]+\]/);
    expect(text()).toContain('ทีมพัฒนา Auoyoo');
    expect(text()).toContain('มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน');
    expect(text()).toContain('Hostinger (VPS) ศูนย์ข้อมูลที่กัวลาลัมเปอร์ ประเทศมาเลเซีย');
    expect(text()).toContain('เราจะตอบกลับภายใน 30 วัน');
  });

  it('ระยะเก็บ log ตรงกับ logging ใน docker-compose.yml (10 MB x 10 ไฟล์ ≈ 100 MB ต่อส่วน)', () => {
    expect(text()).toContain('เก็บไม่เกินประมาณ 100 MB ต่อส่วน (ไฟล์ละ 10 MB สูงสุด 10 ไฟล์)');
  });

  it('อีเมลติดต่อมาจาก CONTACT_EMAIL ของ backend (ที่เดียวกับ footer); ยังไม่ตั้ง -> บอกว่ายังไม่ได้ระบุ', () => {
    const contact = () => el.querySelector('.pp-contact')!.textContent!.replace(/\s+/g, ' ');
    expect(contact()).toContain('ยังไม่ได้ระบุอีเมลติดต่อ');
    expect(el.querySelector('.pp-email')).toBeNull();

    TestBed.inject(SiteConfigService).config.set({ siteUrl: 'https://x', contactEmail: 'team@example.ac.th', googleClientId: '' });
    fixture.detectChanges();
    const link = el.querySelector('.pp-email') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('team@example.ac.th');
    expect(link.getAttribute('href')).toBe('mailto:team@example.ac.th');
  });

  it('ตรงกับที่ระบบทำจริง: ชื่อ cookie/localStorage, ไม่เก็บรูปจาก Google, AI รันเอง', () => {
    const codes = Array.from(el.querySelectorAll('.pp-table code')).map(c => c.textContent);
    expect(codes).toEqual(['refresh_token', 'compareList', 'aiGuestQuotaUsed']);
    expect(text()).toContain('เราไม่เก็บรูปโปรไฟล์จาก Google');
    expect(text()).toContain('openid, email, profile');
    expect(text()).toContain('Ollama');
  });

  it('สารบัญเลื่อนไปหัวข้อในหน้าเดียวกัน (ไม่เปลี่ยนหน้า) และย้ายโฟกัสไปหัวข้อ', () => {
    const target = el.querySelector('#pp-cookie') as HTMLElement;
    const scroll = spyOn(target, 'scrollIntoView');
    const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('.pp-toc a')).find(a => a.getAttribute('href') === '#pp-cookie')!;
    const click = new MouseEvent('click', { cancelable: true, bubbles: true });

    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBeTrue();
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(target.querySelector('h2'));
  });

  it('เปิดหน้าแล้วเริ่มที่บนสุด (มาจากลิงก์ใน footer ท้ายหน้า)', () => {
    const scrollTo = spyOn(window, 'scrollTo');
    TestBed.createComponent(PrivacyPolicyComponent).detectChanges();
    expect(scrollTo.calls.mostRecent().args as unknown[]).toEqual([{ top: 0, behavior: 'auto' }]);
  });

  it('ลิงก์จัดการข้อมูลด้วยตัวเอง: โปรไฟล์ ประวัติ รายการโปรด และลบบัญชีเองได้ที่หน้าโปรไฟล์ (ขอสำเนายังส่งอีเมล)', () => {
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('#pp-rights a')).map(a => [a.textContent!.trim(), a.getAttribute('href')]);
    expect(links).toEqual([['หน้าโปรไฟล์', '/profile'], ['หน้าประวัติ', '/history'], ['รายการโปรด', '/favorites'], ['ลบบัญชี', '/profile']]);
    const rights = el.querySelector('#pp-rights')!.textContent!.replace(/\s+/g, ' ');
    expect(rights).toContain('ขอสำเนาข้อมูลทั้งหมด ติดต่อทางอีเมล');
    expect(rights).not.toContain('ยังไม่มีปุ่มลบบัญชี');
  });
});
