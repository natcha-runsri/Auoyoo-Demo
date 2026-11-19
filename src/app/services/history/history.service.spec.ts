import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HistoryService } from './history.service';
import { AuthService } from '../authen/auth.service';
import { environment } from '../../../environments/environment';

describe('HistoryService', () => {
  let service: HistoryService;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  const base = `${environment.apiUrl}/history`;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn']);
    auth.isLoggedIn.and.returnValue(true);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }]
    });
    service = TestBed.inject(HistoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ไม่ได้ล็อกอิน -> ไม่ส่งอะไรไปบันทึกเลย', () => {
    auth.isLoggedIn.and.returnValue(false);
    service.recordSearch('เมาส์');
    service.recordView(7);
    http.expectNone(() => true);
    expect().nothing();
  });

  it('ล็อกอินอยู่ -> บันทึกคำค้น (ตัดช่องว่าง) และการเข้าชม; คำค้นว่างไม่ส่ง; error ไม่หลุดออกมา', () => {
    service.recordSearch('   ');
    http.expectNone(`${base}/searches`);

    service.recordSearch('  เมาส์ไร้สาย ');
    const search = http.expectOne(`${base}/searches`);
    expect(search.request.method).toBe('POST');
    expect(search.request.body).toEqual({ query: 'เมาส์ไร้สาย' });
    search.flush(null, { status: 500, statusText: 'x' });

    service.recordView(7);
    expect(http.expectOne(`${base}/views`).request.body).toEqual({ productId: 7 });
  });

  it('อ่าน/ลบ ใช้ endpoint ตามวันที่และช่วงที่เลือก', () => {
    service.getDay('2026-08-11').subscribe();
    http.expectOne(`${base}?date=2026-08-11`).flush({ date: '2026-08-11', items: [] });
    service.getSummary('2026-08-11', 30).subscribe();
    http.expectOne(`${base}/summary?date=2026-08-11&range=30`).flush({});
    service.getActiveDays('2026-08').subscribe();
    http.expectOne(`${base}/days?month=2026-08`).flush([]);
    service.delete(5).subscribe();
    expect(http.expectOne(`${base}/5`).request.method).toBe('DELETE');
    service.deleteAll().subscribe();
    expect(http.expectOne(base).request.method).toBe('DELETE');
  });
});
