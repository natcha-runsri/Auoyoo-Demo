import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface Category {
  name: string;
  image: string;
  slug: string;
}

interface Gadget {
  title: string;
  image: string;
  /** คำอธิบายรูปสำหรับ screen reader */
  alt: string;
  /** ตำแหน่งในกริด (ดู .gadget-grid ใน home.component.css) */
  area: 'laptop' | 'printer' | 'keyboard' | 'headphone' | 'mouse';
  /** มุมที่วางชื่อการ์ด ตาม mockup */
  label: 'bottom-left' | 'top-right';
  slug: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy{
  
  // slug = URL หน้าหมวด /category/{slug} (ชุดเดียวกับ backend CategoryService.slugOf และ sitemap.xml)
  // ปุ่มที่รวม 2 หมวด ("เครื่องเสียง" = หูฟัง+ลำโพง, "คีย์บอร์ด & เมาส์") ชี้หมวดที่ตรงกับรูปมากที่สุด
  categories: Category[] = [
    { name: 'โน้ตบุ๊ก', image: 'images/labtop.svg', slug: 'notebook' },
    { name: 'อุปกรณ์เครื่องเสียง', image: 'images/audio.svg', slug: 'headphone' },
    { name: 'เครื่องพิมพ์', image: 'images/print.svg', slug: 'printer' },
    { name: 'อุปกรณ์เสริม', image: 'images/ch.svg', slug: 'accessories' },
    { name: 'คีย์บอร์ด & เมาส์', image: 'images/k.svg', slug: 'keyboard' }
  ];

  // "Gadget ที่ควรมี 2026" — เฉพาะหมวดที่มีสินค้าใน DB (Power Bank / Tablets เอาออกแล้ว ไม่มีสินค้า)
  // Keyboard / Mouse แยกหมวดย่อยใน DB ได้ จึงชี้ไปหมวดของตัวเองตรง ๆ
  // รูปใหม่จาก Unsplash (Unsplash License ใช้ฟรี ไม่บังคับให้เครดิต):
  //   gadget-keyboard.jpg  Chris J. Davis — https://unsplash.com/photos/PT_9ux0j-x4
  //   gadget-mouse.jpg     Pascal M.      — https://unsplash.com/photos/4PchFKrUw84
  gadgets: Gadget[] = [
    { title: 'Laptops', image: 'images/lab.svg', alt: 'โน้ตบุ๊ก', area: 'laptop', label: 'bottom-left', slug: 'notebook' },
    { title: 'Printer', image: 'images/prin.svg', alt: 'ปริ้นเตอร์', area: 'printer', label: 'top-right', slug: 'printer' },
    { title: 'Keyboard', image: 'images/gadget-keyboard.jpg', alt: 'คีย์บอร์ด', area: 'keyboard', label: 'top-right', slug: 'keyboard' },
    { title: 'Headphone', image: 'images/head.svg', alt: 'หูฟัง', area: 'headphone', label: 'bottom-left', slug: 'headphone' },
    { title: 'Mouse', image: 'images/gadget-mouse.jpg', alt: 'เมาส์', area: 'mouse', label: 'top-right', slug: 'mouse' }
  ];

    promoImages: string[] = [
    'images/b1.svg',
    'images/b2.svg',
    'images/b3.svg',
    'images/b4.svg'
  ];

  currentSlide = 0;
  private slideInterval: any;

  /** แถวหมวดหมู่เลื่อนแนวนอน: ซ่อนลูกศรซ้ายเมื่ออยู่ต้นสุด ขวาเมื่ออยู่ท้ายสุด (การ์ดพอดีจอ = ซ่อนทั้งคู่) */
  canScrollPrev = false;
  canScrollNext = false;
  @ViewChild('categoriesRow') private categoriesRow?: ElementRef<HTMLElement>;
  @ViewChildren('categoryCard') private categoryCards?: QueryList<ElementRef<HTMLElement>>;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.slideInterval = setInterval(() => {
      this.nextSlide();
    }, 4000); // เปลี่ยนรูปทุก 4 วินาที
  }

  ngAfterViewInit(): void {
    // เช็กหลัง view พร้อม และทุกครั้งที่จำนวนการ์ดเปลี่ยน (เผื่อหมวดหมู่มาแบบ async ภายหลัง)
    // setTimeout: เลี่ยงแก้ค่าที่ template ใช้ระหว่างรอบ change detection เดียวกัน
    setTimeout(() => this.updateCategoryArrows());
    this.categoryCards?.changes.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => setTimeout(() => this.updateCategoryArrows()));
  }

  ngOnDestroy(): void {
    clearInterval(this.slideInterval);
  }

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.promoImages.length;
  }

  goToSlide(index: number): void {
    this.currentSlide = index;
  }

  @HostListener('window:resize')
  updateCategoryArrows(): void {
    const row = this.categoriesRow?.nativeElement;
    if (!row) return;
    const maxScroll = row.scrollWidth - row.clientWidth;
    // เผื่อ 1px — scrollLeft บนจอ hi-DPI เป็นทศนิยมได้
    this.canScrollPrev = row.scrollLeft > 1;
    this.canScrollNext = row.scrollLeft < maxScroll - 1;
  }

  /** เลื่อนทีละ ~80% ของความกว้างที่มองเห็น (scroll-snap จัดให้หยุดตรงขอบการ์ด) */
  scrollCategories(direction: 1 | -1): void {
    const row = this.categoriesRow?.nativeElement;
    row?.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: 'smooth' });
  }
}
