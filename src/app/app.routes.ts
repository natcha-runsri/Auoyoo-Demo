import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { RecommendationsComponent } from './pages/recommendations/recommendations.component';
import { FavoritesComponent } from './pages/favorites/favorites.component';
import { AuthRedirectComponent } from './pages/auth-redirect/auth-redirect.component';
import { CategoryPageComponent } from './pages/category/category-page/category-page.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { HistoryComponent } from './pages/history/history.component';
import { HistoryChatComponent } from './pages/history/history-chat.component';
import { PrivacyPolicyComponent } from './pages/privacy/privacy-policy.component';
import { authGuard } from './guards/auth.guard';
import { PageSeo } from './services/seo/seo.service';
import { CATEGORY_INDEX_SEO, HOME_SEO } from './services/seo/page-seo';

export const routes: Routes = [
  { path: '', component: HomeComponent, data: { seo: HOME_SEO } },
  { path: 'category', component: CategoryPageComponent, data: { seo: CATEGORY_INDEX_SEO } },
  {
    path: 'privacy', component: PrivacyPolicyComponent,
    data: { seo: {
      title: 'นโยบายความเป็นส่วนตัว | AuoYoo',
      description: 'AuoYoo เก็บข้อมูลอะไร ใช้ทำอะไร การเข้าสู่ระบบด้วย Google, cookie และสิทธิของคุณตาม PDPA'
    } satisfies PageSeo }
  },
  {
    path: 'recommendations', component: RecommendationsComponent,
    data: { seo: {
      title: 'AI แนะนำสินค้าไอที | AuoYoo',
      description: 'บอกงบประมาณและการใช้งาน แล้วให้ AI ของ AuoYoo ช่วยเลือกโน้ตบุ๊ก หูฟัง จอ และอุปกรณ์ไอทีที่คุ้มค่า '
        + 'พร้อมตารางเปรียบเทียบสเปกและราคา'
    } satisfies PageSeo }
  },
  // หน้าส่วนตัว: ไม่ให้ search engine เก็บ (และ robots.txt ห้ามเข้าด้วย)
  {
    path: 'favorites', component: FavoritesComponent,
    data: { seo: { title: 'รายการโปรด | AuoYoo', description: 'รายการสินค้าที่คุณบันทึกไว้ใน AuoYoo', noindex: true } satisfies PageSeo }
  },
  {
    path: 'profile', component: ProfileComponent, canActivate: [authGuard],
    data: { seo: { title: 'โปรไฟล์ผู้ใช้ | AuoYoo', description: 'จัดการโปรไฟล์ผู้ใช้ AuoYoo', noindex: true } satisfies PageSeo }
  },
  {
    path: 'history', component: HistoryComponent, canActivate: [authGuard],
    data: { seo: { title: 'ประวัติการใช้งาน | AuoYoo', description: 'ประวัติการใช้งาน AuoYoo ของคุณ', noindex: true } satisfies PageSeo }
  },
  // แชท AI ที่บันทึกไว้ — อ่านอย่างเดียว
  {
    path: 'history/chat/:id', component: HistoryChatComponent, canActivate: [authGuard],
    data: { seo: { title: 'แชท AI ที่บันทึกไว้ | AuoYoo', description: 'บทสนทนากับ AI แนะนำสินค้าของคุณ', noindex: true } satisfies PageSeo }
  },
  // /login, /register: deep link เข้าตรง ๆ -> เปิด auth-modal-host ที่หน้าแรกแทน (ดู AuthRedirectComponent)
  { path: 'login', component: AuthRedirectComponent, data: { authView: 'login' } },
  { path: 'register', component: AuthRedirectComponent, data: { authView: 'register' } },
  // ลิงก์รีเซ็ตจากอีเมลแบบเก่า (/reset-password?token=...) เลิกใช้แล้ว — เปิด popup ลืมรหัสผ่าน (รหัส 6 หลัก) แทน
  { path: 'reset-password', component: AuthRedirectComponent, data: { authView: 'forgot' } },
  // หน้าหมวดตาม slug และหน้าสินค้า: CategoryPageComponent / ProductDetailComponent ตั้ง SEO เองหลังโหลดข้อมูล
  { path: 'category/:slug', component: CategoryPageComponent },
  { path: 'products/:id', component: ProductDetailComponent },
];
