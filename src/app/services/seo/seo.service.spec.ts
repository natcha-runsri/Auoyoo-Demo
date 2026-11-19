import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { SeoService, OG_IMAGE_PATH, truncateText } from './seo.service';
import { SiteConfigService } from '../site-config/site-config.service';
import { CategoryService } from '../category/category.service';
import { ProductService } from '../product/product.service';
import { CategoryPageComponent } from '../../pages/category/category-page/category-page.component';
import { Category } from '../../models/category';

const SITE = 'https://auoyoo.example.ac.th';

const TREE: Category[] = [{
  name: 'อุปกรณ์ทั้งหมด', count: 3000, slug: null, children: [
    { name: 'โน้ตบุ๊ค', categoryKey: 'Notebook', slug: 'notebook', count: 699, children: [] },
    { name: 'เมาส์', categoryKey: 'Mouse', slug: 'mouse', count: 1012, children: [] }
  ]
}];

describe('SeoService (title/meta ตาม route)', () => {
  let harness: RouterTestingHarness;
  let title: Title;
  let meta: Meta;
  let productService: jasmine.SpyObj<ProductService>;

  const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const metaName = (name: string) => meta.getTag(`name="${name}"`)?.content;
  const metaProp = (prop: string) => meta.getTag(`property="${prop}"`)?.content;

  beforeEach(async () => {
    productService = jasmine.createSpyObj<ProductService>('ProductService', ['search', 'getById', 'getPriceRange']);
    productService.getPriceRange.and.returnValue(of({ min: null, max: null }));
    productService.search.and.returnValue(of({ content: [], totalPages: 0, totalElements: 0, number: 0, size: 9 }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CategoryService, useValue: { getCategoryTree: () => of(TREE), getBrands: () => of([]) } },
        { provide: ProductService, useValue: productService }
      ]
    });
    TestBed.inject(SiteConfigService).config.set({ siteUrl: SITE, contactEmail: '', googleClientId: '' });
    TestBed.inject(SeoService).init();
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
    harness = await RouterTestingHarness.create();
  });

  it('หน้าหลัก: title/description ภาษาไทย, index, canonical และ og ใช้ URL จริงของเว็บ', async () => {
    await harness.navigateByUrl('/');
    expect(title.getTitle()).toBe('AuoYoo - แนะนำและเปรียบเทียบอุปกรณ์ไอที');
    expect(metaName('description')).toContain('เปรียบเทียบราคาและสเปก');
    expect(metaName('robots')).toBe('index, follow');
    expect(canonical()).toBe(`${SITE}/`);
    expect(metaProp('og:url')).toBe(`${SITE}/`);
    expect(metaProp('og:title')).toBe(title.getTitle());
  });

  it('og:image เป็นรูปของเว็บเราเอง ไม่ใช่รูปจากร้านค้า', async () => {
    await harness.navigateByUrl('/recommendations');
    expect(metaProp('og:image')).toBe(`${SITE}/${OG_IMAGE_PATH}`);
  });

  it('หน้าส่วนตัว (/favorites) ใส่ noindex', async () => {
    await harness.navigateByUrl('/favorites');
    expect(title.getTitle()).toBe('รายการโปรด | AuoYoo');
    expect(metaName('robots')).toBe('noindex, nofollow');
  });

  it('หน้าหมวดตาม slug: title เป็นชื่อหมวด เลือกหมวดนั้นจริง และ canonical ไม่มี query', async () => {
    const page = await harness.navigateByUrl('/category/notebook?page=2', CategoryPageComponent);
    expect(title.getTitle()).toBe('โน้ตบุ๊ค แนะนำและเปรียบเทียบ | AuoYoo');
    expect(metaName('description')).toContain('โน้ตบุ๊ค 699 รายการ');
    expect(canonical()).toBe(`${SITE}/category/notebook`);
    expect(page.selectedNode?.categoryKey).toBe('Notebook');
    expect(productService.search).toHaveBeenCalledWith(jasmine.objectContaining({ category: 'Notebook' }));
  });

  it('หมวดต่างกันได้ title/description ไม่ซ้ำกัน', async () => {
    await harness.navigateByUrl('/category/notebook');
    const first = [title.getTitle(), metaName('description')];
    await harness.navigateByUrl('/category/mouse');
    expect(title.getTitle()).toBe('เมาส์ แนะนำและเปรียบเทียบ | AuoYoo');
    expect([title.getTitle(), metaName('description')]).not.toEqual(first);
  });

  it('คลิกหมวดใน sidebar -> URL เปลี่ยนเป็น /category/{slug}', async () => {
    const page = await harness.navigateByUrl('/category', CategoryPageComponent);
    expect(title.getTitle()).toBe('หมวดหมู่สินค้าไอที แนะนำและเปรียบเทียบ | AuoYoo');
    page.onCategorySelect('mouse');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/category/mouse');
  });

  it('slug ที่ไม่รู้จัก -> แสดงทุกหมวด และ canonical ชี้ /category', async () => {
    const page = await harness.navigateByUrl('/category/unknown-thing', CategoryPageComponent);
    expect(page.selectedNode).toBeNull();
    expect(canonical()).toBe(`${SITE}/category`);
  });

  it('ตัด description ยาวให้ไม่เกิน 160 ตัวอักษร', () => {
    expect(truncateText('ก'.repeat(300)).length).toBe(160);
    expect(truncateText('  สั้น   ๆ  ')).toBe('สั้น ๆ');
  });
});
