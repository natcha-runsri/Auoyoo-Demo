import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductImageDirective } from '../../components/product-image/product-image.directive';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { Product } from '../../models/product';
import { CompareService } from '../../services/compare/compare.service';
import { ChatDockService } from '../../services/chat-dock/chat-dock.service';

/**
 * แถบเปรียบเทียบแบบลอย แสดงทุกหน้า (mount ที่ AppComponent)
 * - ย่อ/ขยายได้ด้วยปุ่มลูกศร
 * - พอมีสินค้าใหม่ถูกเพิ่ม จะกางออกอัตโนมัติ
 * - ซ่อนทั้งแถบเมื่อ list ว่าง
 * - หน้าแชท AI (ช่องพิมพ์ล็อกกับจอ — ChatDockService.active$): ย้ายไปอยู่เหนือช่องพิมพ์ หุบเป็นแบบย่อ
 *   (จำนวน + ปุ่มเปรียบเทียบ) ไม่กางเองตอนเพิ่มสินค้า ออกจากหน้าแชทแล้วคืนสถานะย่อ/ขยายเดิม
 *
 * รายการสินค้า render จาก compareService.items$ ผ่าน async pipe โดยตรง
 * ไม่ถือ local copy ไว้เอง เพื่อให้ UI สะท้อน state ของ service เสมอ (รวมถึงตอนกด "ล้างทั้งหมด")
 */
/** ระยะห่างระหว่างแถบเปรียบเทียบกับช่องพิมพ์ของหน้าแชท */
export const DOCK_GAP_PX = 10;

@Component({
  selector: 'app-compare-bar',
  standalone: true,
  imports: [CommonModule, ProductImageDirective],
  templateUrl: './compare-bar.component.html',
  styleUrls: ['./compare-bar.component.css']
})
export class CompareBarComponent implements OnInit, OnDestroy {
  readonly items$: Observable<Product[]>;
  collapsed = false;
  readonly max: number;
  /** ความสูงแถบลอย -> ที่ว่างท้ายหน้า ให้เนื้อหาเลื่อนพ้นแถบได้ */
  barHeight = 0;
  /** อยู่หน้าแชท AI: วางเหนือช่องพิมพ์ (ไม่ใช่ขอบล่างจอ) และไม่ต้องมีที่ว่างท้ายหน้าเอง (หน้าแชทเผื่อให้) */
  docked = false;
  /** ระยะจากขอบล่างจอตอน docked = เหนือช่องพิมพ์ */
  dockBottom = 0;
  private collapsedBeforeDock = false;
  private resizeObserver?: ResizeObserver;

  /** แถบถูกสร้าง/ถอดตามจำนวนสินค้า -> ผูก/ปลด ResizeObserver ตาม */
  @ViewChild('bar') set barRef(ref: ElementRef<HTMLElement> | undefined) {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (!ref || typeof ResizeObserver === 'undefined') {
      this.barHeight = 0;
      this.chatDock.compareBarHeight$.next(0);
      return;
    }
    this.resizeObserver = new ResizeObserver(entries => {
      const height = Math.ceil(entries[0].target.getBoundingClientRect().height);
      if (height !== this.barHeight) this.zone.run(() => (this.barHeight = height));
      if (height !== this.chatDock.compareBarHeight$.value) this.zone.run(() => this.chatDock.compareBarHeight$.next(height));
    });
    this.resizeObserver.observe(ref.nativeElement);
  }

  private sub = new Subscription();

  constructor(public compareService: CompareService, private router: Router, private zone: NgZone,
              private chatDock: ChatDockService) {
    this.items$ = compareService.items$;
    this.max = compareService.max;
  }

  ngOnInit(): void {
    // มีสินค้าใหม่เข้ามา -> กางออกให้เห็นเลย
    // (หน้าแชท AI ไม่กางเอง — กันแถบบังพื้นที่แชท ผู้ใช้เห็นจำนวนเปลี่ยนในแถบย่ออยู่แล้ว)
    this.sub.add(this.compareService.added$.subscribe(() => {
      if (!this.docked) this.collapsed = false;
    }));
    this.sub.add(this.chatDock.active$.subscribe(active => this.setDocked(active)));
    this.sub.add(this.chatDock.dockTop$.subscribe(top => (this.dockBottom = top + DOCK_GAP_PX)));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.resizeObserver?.disconnect();
  }

  /** เข้าหน้าแชท: หุบเป็นแบบย่อ; ออก: คืนสถานะเดิม */
  private setDocked(active: boolean): void {
    if (active === this.docked) return;
    if (active) {
      this.collapsedBeforeDock = this.collapsed;
      this.collapsed = true;
    } else {
      this.collapsed = this.collapsedBeforeDock;
    }
    this.docked = active;
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  remove(id: number): void {
    this.compareService.remove(id);
  }

  clearAll(): void {
    this.compareService.clear();
    // ถ้ากำลังอยู่หน้า /recommendations ที่โชว์ตารางเปรียบเทียบจาก ?ids=... ใน URL
    // ต้องล้าง query param นั้นด้วย ไม่งั้น URL/หน้าตารางจะค้างอ้างอิง id ของ compare list ที่เพิ่งล้างไปแล้ว
    // (RecommendationsComponent อ่านจาก URL ล้วน ๆ ไม่ได้ผูกกับ CompareService)
    const [path] = this.router.url.split('?');
    if (path === '/recommendations') {
      void this.router.navigate(['/recommendations'], { replaceUrl: true });
    }
  }

  compareNow(): void {
    const items = this.compareService.items;
    if (items.length < 2) {
      return;
    }
    const ids = items.map(p => p.id).join(',');
    void this.router.navigate(['/recommendations'], { queryParams: { ids } });
  }

  priceOf(p: Product): number {
    return p.priceMin ?? p.priceMax ?? 0;
  }

  trackById(_: number, p: Product): number {
    return p.id;
  }
}
