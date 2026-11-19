import { AfterViewInit, Component, DestroyRef, ElementRef, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Observable, skip } from 'rxjs';
import { AuthModalHostComponent } from './components/auth-modal-host/auth-modal-host.component';
import { CompareBarComponent } from './components/compare-bar/compare-bar.component';
import { FavoriteService } from './services/favorite/favorite.service';
import { UserMenuComponent } from './components/user-menu/user-menu.component';
import { UserProfileService } from './services/user-profile/user-profile.service';
import { AuthService } from './services/authen/auth.service';
import { SiteFooterComponent } from './components/site-footer/site-footer.component';
import { DrawerMenuComponent } from './components/drawer-menu/drawer-menu.component';
import { FlashMessageComponent } from './components/flash-message/flash-message.component';
import { SeoService } from './services/seo/seo.service';

interface Category {
  name: string;
  image: string;
}

interface Gadget {
  title: string;
  image: string;
  size: 'tall' | 'wide' | 'square';
  slug: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, AuthModalHostComponent, CompareBarComponent, UserMenuComponent, SiteFooterComponent, DrawerMenuComponent, FlashMessageComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'frontend';

  readonly favoriteCount$: Observable<number>;
  /** แผงเมนูด้านข้าง (จอเล็กกว่า 1024px) — logic ทั้งหมดอยู่ใน DrawerMenuComponent */
  menuOpen = false;
  @ViewChild('siteHeader') private siteHeader?: ElementRef<HTMLElement>;
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  constructor(
    private router: Router,
    private favoriteService: FavoriteService,
    private userProfile: UserProfileService,
    private auth: AuthService,
    seo: SeoService
  ) {
    // title/meta/canonical/og ตาม route (ดู SeoService)
    seo.init();
    this.favoriteCount$ = this.favoriteService.count$;
  }

  ngOnInit(): void {
    // โหลดรายการโปรดของ user (ถ้าล็อกอินอยู่) ให้ badge/หัวใจทุกที่ sync กันตั้งแต่เปิดแอป
    this.favoriteService.load();
    this.userProfile.loadCurrentUser();

    // ทุกครั้งที่สถานะ login เปลี่ยนหลังจากนี้ (login, logout, session หมดอายุ, login/logout จากแท็บอื่น)
    // โหลด/ล้างข้อมูลของ user จากจุดเดียว — skip(1) เพราะค่าแรกโหลดไปแล้วด้านบน
    this.auth.loggedIn$.pipe(skip(1), takeUntilDestroyed(this.destroyRef)).subscribe(loggedIn => {
      if (loggedIn) {
        this.favoriteService.load(true);
        this.userProfile.loadCurrentUser();
      } else {
        this.favoriteService.reset();
        this.userProfile.clear();
      }
    });
  }

  /**
   * header ติดบนจอ: เงาเฉพาะตอนเลื่อนลงจากบนสุดแล้ว + ความสูงจริงของ header -> --site-header-h
   * (scroll-margin-top ของจุดที่เลื่อนไปหา และหัวตารางเปรียบเทียบที่ติดบนจอ ใช้หลบ header)
   * ทำนอก Angular zone — เลื่อนหน้าไม่ต้องทำ change detection ทั้งแอป
   */
  ngAfterViewInit(): void {
    const header = this.siteHeader?.nativeElement;
    const win = this.document.defaultView;
    if (!header || !win) return;
    this.zone.runOutsideAngular(() => {
      const updateShadow = () => header.classList.toggle('scrolled', win.scrollY > 0);
      win.addEventListener('scroll', updateShadow, { passive: true });
      updateShadow();
      const root = this.document.documentElement;
      const observer = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => root.style.setProperty('--site-header-h', `${header.offsetHeight}px`)) : undefined;
      observer?.observe(header);
      this.destroyRef.onDestroy(() => {
        win.removeEventListener('scroll', updateShadow);
        observer?.disconnect();
      });
    });
  }

  /**
   * ช่องค้นหา navbar -> หน้าแชท AI แนะนำ (/recommendations?q=...) ซึ่งส่งคำค้นเป็นข้อความแรกในแชทให้เอง
   * ว่าง/มีแต่เว้นวรรค = ไม่ทำอะไร; ส่งแล้วล้างช่อง
   */
  onSearch(input: HTMLInputElement): void {
    const trimmed = input.value.trim();
    if (!trimmed) {
      return;
    }
    input.value = '';
    void this.router.navigate(['/recommendations'], {
      queryParams: { q: trimmed }
    });
  }

  /** โลโก้: routerLink="/" พาไปหน้าหลักอยู่แล้ว — ถ้าอยู่หน้าหลักอยู่แล้ว (ไม่มีการเปลี่ยนหน้า) เลื่อนขึ้นบนสุดแทน */
  onLogoClick(): void {
    if (this.router.url === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
