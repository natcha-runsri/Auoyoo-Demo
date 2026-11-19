import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SiteConfigService } from '../site-config/site-config.service';

export interface PageSeo {
  /** <title> เต็ม เช่น "โน้ตบุ๊ค แนะนำและเปรียบเทียบ | AuoYoo" */
  title: string;
  /** meta description (ภาษาไทย ไม่ซ้ำกันแต่ละหน้า) */
  description: string;
  /** หน้าส่วนตัว -> meta robots "noindex, nofollow" */
  noindex?: boolean;
  /** path ของ canonical (ไม่มี query) — ไม่ระบุ = path ปัจจุบัน */
  canonicalPath?: string;
}

/** รูปพรีวิวตอนแชร์ลิงก์ (LINE/Facebook) — รูปของเว็บเราเอง ไม่ใช้รูปสินค้าจากร้านค้า */
export const OG_IMAGE_PATH = 'images/og-cover.png';
export const SITE_NAME = 'AuoYoo';

/**
 * ตั้ง <title>, meta description, robots, canonical และ Open Graph ตาม route
 *  - หน้าทั่วไป: ใส่ data: { seo: PageSeo } ไว้ใน app.routes.ts -> ตั้งให้อัตโนมัติทุกครั้งที่เปลี่ยนหน้า
 *  - หน้าที่ต้องรอข้อมูล (สินค้า, หมวดหมู่ตาม slug): component เรียก setPage() เองหลังโหลดเสร็จ
 * URL เต็มใช้ siteUrl จาก SiteConfigService (FRONTEND_URL ใน .env ของ backend)
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly site = inject(SiteConfigService);

  /** เริ่มฟังการเปลี่ยนหน้า — เรียกครั้งเดียวจาก AppComponent */
  init(): void {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      const seo = deepestData(this.router.routerState.snapshot.root)['seo'] as PageSeo | undefined;
      if (seo) {
        this.setPage(seo);
      }
    });
  }

  setPage(seo: PageSeo): void {
    const url = this.absoluteUrl(seo.canonicalPath ?? currentPath(this.router.url));
    const image = this.absoluteUrl(OG_IMAGE_PATH);

    this.title.setTitle(seo.title);
    this.meta.updateTag({ name: 'description', content: seo.description });
    this.meta.updateTag({ name: 'robots', content: seo.noindex ? 'noindex, nofollow' : 'index, follow' });

    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:locale', content: 'th_TH' });
    this.meta.updateTag({ property: 'og:title', content: seo.title });
    this.meta.updateTag({ property: 'og:description', content: seo.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

    this.setCanonical(url);
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private absoluteUrl(path: string): string {
    return this.site.siteUrl + (path.startsWith('/') ? path : '/' + path);
  }
}

function deepestData(route: ActivatedRouteSnapshot): Record<string, unknown> {
  let node = route;
  while (node.firstChild) node = node.firstChild;
  return node.data ?? {};
}

/** path ล้วน ๆ ไม่มี ?query และ #hash (canonical ไม่รวมตัวกรอง/หน้าที่) */
function currentPath(url: string): string {
  return url.split(/[?#]/)[0] || '/';
}

/** ตัดข้อความยาวให้พอดี meta description (~160 ตัวอักษร) */
export function truncateText(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + '…';
}
