import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthModalService, AuthView } from '../../services/auth-modal/auth-modal.service';

/**
 * Route entry point แบบเบา ๆ สำหรับ /login และ /register (deep link / พิมพ์ URL ตรง ๆ)
 * แค่สั่งเปิด view ที่ต้องการผ่าน AuthModalService (host เดียวกับทุกที่) แล้ว redirect ไปหน้าแรกทันที
 * กัน component ฟอร์มเปล่า ๆ (ไม่มีกรอบ modal) render ซ้อนอยู่ข้างใต้ modal host โดยไม่ตั้งใจ
 */
@Component({
  selector: 'app-auth-redirect',
  standalone: true,
  imports: [],
  template: '',
})
export class AuthRedirectComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authModal: AuthModalService
  ) {}

  ngOnInit(): void {
    const view = this.route.snapshot.data['authView'] as Exclude<AuthView, null>;
    this.authModal.open(view);
    void this.router.navigate(['/'], { replaceUrl: true });
  }
}
