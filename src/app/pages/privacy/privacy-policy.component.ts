import { Component, OnInit, computed, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SiteConfigService } from '../../services/site-config/site-config.service';

/** วันที่ปรับปรุงนโยบายล่าสุด — แก้ทุกครั้งที่แก้เนื้อหา */
export const PRIVACY_LAST_UPDATED = '31 ตุลาคม 2569';

/**
 * นโยบายความเป็นส่วนตัว (/privacy) — เนื้อหาต้องตรงกับสิ่งที่ระบบทำจริง (ดูหมายเหตุใน template)
 * ลิงก์จาก footer ทุกหน้า และจากฟอร์มเข้าสู่ระบบ
 */
@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css'
})
export class PrivacyPolicyComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly site = inject(SiteConfigService);
  readonly lastUpdated = PRIVACY_LAST_UPDATED;
  /** อีเมลติดต่อจาก CONTACT_EMAIL ของ backend (ที่เดียวกับ footer) — ว่าง = ยังไม่ได้ตั้ง */
  readonly contactEmail = computed(() => this.site.config().contactEmail);

  /** มาจากลิงก์ท้ายหน้า (footer) -> router ไม่เลื่อนให้เอง: เริ่มอ่านจากบนสุด */
  ngOnInit(): void {
    this.document.defaultView?.scrollTo({ top: 0, behavior: 'auto' });
  }

  /**
   * สารบัญ: เลื่อนไปหัวข้อในหน้าเดียวกัน — href="#..." เฉย ๆ จะพากลับหน้าแรก (<base href="/">)
   * header ที่ติดบนจอไม่บังหัวข้อ เพราะ [id] มี scroll-margin-top (styles.css); ย้ายโฟกัสไปหัวข้อด้วยสำหรับคีย์บอร์ด/screen reader
   */
  jumpTo(event: Event, id: string): void {
    event.preventDefault();
    const section = this.document.getElementById(id);
    if (!section) return;
    const reduced = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    const heading = section.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
}
