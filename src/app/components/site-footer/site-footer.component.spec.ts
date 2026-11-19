import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SiteFooterComponent } from './site-footer.component';
import { SiteConfigService } from '../../services/site-config/site-config.service';
import { environment } from '../../../environments/environment';

describe('SiteFooterComponent + SiteConfigService', () => {
  let http: HttpTestingController;
  let site: SiteConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SiteFooterComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    http = TestBed.inject(HttpTestingController);
    site = TestBed.inject(SiteConfigService);
  });

  afterEach(() => http.verify());

  it('แสดงข้อความโปรเจกต์การศึกษา/ไม่ขายสินค้า/ลิขสิทธิ์ร้านค้าต้นทาง', () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('เว็บไซต์นี้เป็นโปรเจกต์เพื่อการศึกษา ให้บริการแนะนำและเปรียบเทียบสินค้าเท่านั้น ไม่มีการขายสินค้า');
    expect(text).toContain('หากต้องการซื้อ กรุณาสั่งซื้อผ่านร้านค้าต้นทาง ราคาอาจเปลี่ยนแปลงได้');
    expect(text).toContain('ข้อมูลสินค้าและรูปภาพเป็นลิขสิทธิ์ของร้านค้าต้นทาง');
    expect(text).toContain('หากต้องการให้นำข้อมูลออก กรุณาติดต่อ');
  });

  it('อีเมลมาจากค่าตั้งของ backend และเป็นลิงก์ mailto', () => {
    site.load().subscribe();
    http.expectOne(`${environment.apiUrl}/site-config`)
      .flush({ siteUrl: 'https://auoyoo.example.ac.th/', contactEmail: 'team@example.ac.th' });

    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a.site-footer-email') as HTMLAnchorElement;
    expect(link.textContent).toBe('team@example.ac.th');
    expect(link.getAttribute('href')).toBe('mailto:team@example.ac.th');
    expect(site.siteUrl).toBe('https://auoyoo.example.ac.th'); // ตัด / ปิดท้าย
  });

  it('backend ไม่ตอบ -> ใช้ URL ที่เปิดอยู่ และไม่มีลิงก์อีเมล', () => {
    let done = false;
    site.load().subscribe(() => (done = true));
    http.expectOne(`${environment.apiUrl}/site-config`).flush(null, { status: 500, statusText: 'err' });

    expect(done).toBeTrue();
    expect(site.siteUrl).toBe(location.origin);
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a.site-footer-email')).toBeNull();
  });

  it('มีลิงก์ "นโยบายความเป็นส่วนตัว" ไป /privacy', () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.site-footer-links a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('นโยบายความเป็นส่วนตัว');
    expect(link.getAttribute('href')).toBe('/privacy');
  });
});
