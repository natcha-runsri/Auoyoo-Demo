import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteConfigService } from '../../services/site-config/site-config.service';

/**
 * footer ทุกหน้า: บอกว่าเป็นโปรเจกต์เพื่อการศึกษา ไม่ขายสินค้า และข้อมูล/รูปเป็นลิขสิทธิ์ของร้านค้าต้นทาง
 * อีเมลติดต่อมาจากค่าตั้ง CONTACT_EMAIL ของ backend (SiteConfigService) + ลิงก์นโยบายความเป็นส่วนตัว
 */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="site-footer">
      <p>
        เว็บไซต์นี้เป็นโปรเจกต์เพื่อการศึกษา ให้บริการแนะนำและเปรียบเทียบสินค้าเท่านั้น ไม่มีการขายสินค้า
        หากต้องการซื้อ กรุณาสั่งซื้อผ่านร้านค้าต้นทาง ราคาอาจเปลี่ยนแปลงได้
      </p>
      <p>
        ข้อมูลสินค้าและรูปภาพเป็นลิขสิทธิ์ของร้านค้าต้นทาง
        หากต้องการให้นำข้อมูลออก กรุณาติดต่อ
        @if (contactEmail()) {
          <a class="site-footer-email" [href]="'mailto:' + contactEmail()">{{ contactEmail() }}</a>
        } @else {
          <span class="site-footer-email missing">ผู้ดูแลเว็บไซต์</span>
        }
      </p>
      <p class="site-footer-links"><a routerLink="/privacy">นโยบายความเป็นส่วนตัว</a></p>
    </footer>
  `,
  styles: [`
    :host { display: block; }
    .site-footer {
      padding: 20px var(--page-gutter) 28px;
      border-top: 1px solid #e7e1d4;
      background: #fdfbf3;
      color: #7a7f88;
      font-size: 12px;
      line-height: 1.7;
      text-align: center;
    }
    .site-footer p { margin: 0 auto; max-width: 860px; }
    .site-footer p + p { margin-top: 4px; }
    .site-footer-email { color: #1c316f; font-weight: 600; word-break: break-all; }
    .site-footer-email.missing { color: inherit; font-weight: 400; }
    .site-footer .site-footer-links { margin-top: 8px; }
    .site-footer-links a { color: #1c316f; font-weight: 600; }
    .site-footer-links a:focus-visible { outline: 2px solid #5b8fd6; outline-offset: 2px; }
    /* มือถือ/แท็บเล็ต: ตัวอักษรอย่างน้อย 13px ให้อ่านง่ายบนจอเล็ก */
    @media (max-width: 1023px) { .site-footer { font-size: 13px; } }
  `]
})
export class SiteFooterComponent {
  private readonly site = inject(SiteConfigService);
  readonly contactEmail = computed(() => this.site.config().contactEmail);
}
