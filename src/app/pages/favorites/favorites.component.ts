import { Component, ElementRef, HostListener, Injector, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { FavoriteService } from '../../services/favorite/favorite.service';
import { AuthService } from '../../services/authen/auth.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { FavoriteProduct } from '../../models/product';
import { categoryLabel } from '../../config/category-labels';
import { FavoriteCardComponent } from './favorite-card.component';
import { FavoriteSort, SORT_OPTIONS, SortOption, parseSort, sortFavorites } from './favorite-utils';

const ALL = 'ทั้งหมด';
/** เวลาที่การ์ดค่อย ๆ หายไปก่อนถอดออกจากหน้า */
export const LEAVE_MS = 250;
/** แถบ "เลิกทำ" แสดงนานเท่านี้ */
export const UNDO_MS = 5000;

/** การ์ดที่เพิ่งกดลบ — ยังแสดงที่ตำแหน่งเดิมระหว่างค่อย ๆ หายไป */
interface Ghost {
  item: FavoriteProduct;
  index: number;
}

/**
 * หน้ารายการโปรด (/favorites, noindex)
 *  - แท็บหมวด: เฉพาะหมวดที่มีในรายการโปรด กดแล้วกรอง (ตรรกะเดิม)
 *  - เรียงลำดับ ?sort=latest|price-asc|price-desc (สินค้าไม่มีราคาอยู่ท้ายเสมอ)
 *  - ลบ: การ์ดค่อย ๆ หาย ตัวเลขหัวข้อ/navbar ลดทันที + แถบ "เลิกทำ" 5 วิ (คืนเวลาบันทึกเดิม)
 */
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink, FavoriteCardComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.css'
})
export class FavoritesComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly all = ALL;
  readonly sortOptions = SORT_OPTIONS;
  readonly skeletons = [0, 1, 2, 3, 4, 5];
  private readonly selectedTab$ = new BehaviorSubject<string>(ALL);
  private readonly sort$ = new BehaviorSubject<FavoriteSort>('latest');
  private readonly ghosts$ = new BehaviorSubject<Ghost[]>([]);

  isLoggedIn = false;
  sort: FavoriteSort = 'latest';
  sortOpen = false;
  now = new Date();
  readonly leaving = new Set<number>();
  /** รายการล่าสุดที่ลบ (กดเลิกทำได้) */
  undo: FavoriteProduct | null = null;

  /** แท็บหมวดหมู่ = ["ทั้งหมด", ...หมวดที่มีในรายการโปรด] */
  tabs$!: Observable<string[]>;
  /** รายการที่กรองตามแท็บและเรียงแล้ว (รวมการ์ดที่กำลังค่อย ๆ หายไป) */
  visible$!: Observable<FavoriteProduct[]>;
  activeTab$ = this.selectedTab$.asObservable();
  count$!: Observable<number>;
  loading$!: Observable<boolean>;

  private visible: FavoriteProduct[] = [];
  private readonly sub = new Subscription();
  private undoTimer?: ReturnType<typeof setTimeout>;
  private readonly leaveTimers = new Set<ReturnType<typeof setTimeout>>();

  @ViewChild('sortButton') private sortButton?: ElementRef<HTMLButtonElement>;
  @ViewChildren('sortItem') private sortItems?: QueryList<ElementRef<HTMLButtonElement>>;

  constructor(
    private favoriteService: FavoriteService,
    private auth: AuthService,
    private authModal: AuthModalService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.auth.isLoggedIn();
    this.favoriteService.load(true);

    const favorites$ = this.favoriteService.favorites$ as Observable<FavoriteProduct[]>;
    this.count$ = this.favoriteService.favorites$.pipe(map(list => list.length));
    this.loading$ = this.favoriteService.loading$ ?? new BehaviorSubject(false);

    this.tabs$ = favorites$.pipe(
      map(list => [ALL, ...Array.from(new Set(list.map(p => p.category))).sort((a, b) => a.localeCompare(b))])
    );

    this.visible$ = combineLatest([favorites$, this.selectedTab$, this.sort$, this.ghosts$]).pipe(
      map(([list, tab, sort, ghosts]) => {
        const filtered = tab === ALL ? list : list.filter(p => p.category === tab);
        const result = [...sortFavorites(filtered, sort)];
        for (const g of [...ghosts].sort((a, b) => a.index - b.index)) {
          if ((tab === ALL || g.item.category === tab) && !result.some(p => p.id === g.item.id)) {
            result.splice(Math.min(g.index, result.length), 0, g.item);
          }
        }
        this.visible = result;
        this.now = new Date();
        return result;
      })
    );

    this.sub.add(this.route.queryParamMap.subscribe(params => {
      this.sort = parseSort(params.get('sort'));
      this.sort$.next(this.sort);
    }));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    clearTimeout(this.undoTimer);
    this.leaveTimers.forEach(t => clearTimeout(t));
  }

  // ===================== แท็บ =====================

  selectTab(tab: string): void {
    this.selectedTab$.next(tab);
  }

  tabLabel(tab: string): string {
    return tab === ALL ? ALL : categoryLabel(tab);
  }

  // ===================== เรียงลำดับ =====================

  get sortOption(): SortOption {
    return SORT_OPTIONS.find(o => o.value === this.sort)!;
  }

  toggleSort(): void {
    this.sortOpen ? this.closeSort() : this.openSort(SORT_OPTIONS.findIndex(o => o.value === this.sort));
  }

  openSort(focusIndex: number): void {
    this.sortOpen = true;
    afterNextRender(() => this.sortItems?.get(focusIndex)?.nativeElement.focus(), { injector: this.injector });
  }

  closeSort(returnFocus = true): void {
    this.sortOpen = false;
    if (returnFocus) this.sortButton?.nativeElement.focus();
  }

  chooseSort(value: FavoriteSort): void {
    this.closeSort();
    if (value === this.sort) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { sort: value === 'latest' ? null : value },
      queryParamsHandling: 'merge' });
  }

  onSortButtonKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.openSort(event.key === 'ArrowDown' ? 0 : SORT_OPTIONS.length - 1);
    }
  }

  onSortMenuKeydown(event: KeyboardEvent, index: number): void {
    const last = SORT_OPTIONS.length - 1;
    const target = event.key === 'ArrowDown' ? (index + 1) % (last + 1)
      : event.key === 'ArrowUp' ? (index + last) % (last + 1)
      : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (target !== null) {
      event.preventDefault();
      this.sortItems?.get(target)?.nativeElement.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSort();
    } else if (event.key === 'Tab') {
      this.closeSort(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.sortOpen && !this.host.nativeElement.querySelector('.sort')?.contains(event.target as Node)) {
      this.closeSort(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.sortOpen) this.closeSort();
  }

  // ===================== ลบ + เลิกทำ =====================

  remove(item: FavoriteProduct): void {
    if (this.leaving.has(item.id)) return;
    const index = Math.max(0, this.visible.findIndex(p => p.id === item.id));
    this.leaving.add(item.id);
    this.ghosts$.next([...this.ghosts$.value, { item, index }]);
    // ตัวเลขหัวข้อ/navbar ลดทันที (FavoriteService อัปเดตแบบ optimistic) ส่วนการ์ดค่อย ๆ หายไปก่อนถอด
    this.favoriteService.remove(item.id).subscribe({ error: () => this.dropGhost(item.id) });
    const timer = setTimeout(() => {
      this.leaveTimers.delete(timer);
      this.dropGhost(item.id);
    }, LEAVE_MS);
    this.leaveTimers.add(timer);

    this.undo = item;
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => (this.undo = null), UNDO_MS);
  }

  undoRemove(): void {
    const item = this.undo;
    if (!item) return;
    this.undo = null;
    clearTimeout(this.undoTimer);
    this.dropGhost(item.id);
    this.favoriteService.add(item, item.savedAt).subscribe({ error: () => undefined });
  }

  private dropGhost(id: number): void {
    this.leaving.delete(id);
    this.ghosts$.next(this.ghosts$.value.filter(g => g.item.id !== id));
    // แท็บที่เลือกไม่มีสินค้าเหลือแล้ว (ลบชิ้นสุดท้ายของหมวด) -> กลับไปแท็บทั้งหมด
    const tab = this.selectedTab$.value;
    if (tab !== ALL && !this.favoriteService.favorites.some(p => p.category === tab)
        && !this.ghosts$.value.some(g => g.item.category === tab)) {
      this.selectedTab$.next(ALL);
    }
  }

  isLeaving(id: number): boolean {
    return this.leaving.has(id);
  }

  trackById(_: number, p: FavoriteProduct): number {
    return p.id;
  }

  promptLogin(): void {
    this.authModal.open('login', { reason: 'เข้าสู่ระบบเพื่อดูรายการโปรดของคุณ' });
  }
}
