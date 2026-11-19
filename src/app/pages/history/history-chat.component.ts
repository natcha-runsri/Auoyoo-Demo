import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { HistoryService, SavedChat } from '../../services/history/history.service';
import { UserProfileService } from '../../services/user-profile/user-profile.service';
import { ProductCardComponent } from '../category/product-card/product-card.component';
import { DEFAULT_AVATAR } from '../../components/user-menu/user-menu.component';

/**
 * อ่านแชท AI ที่บันทึกไว้ย้อนหลัง (/history/chat/:id) — อ่านอย่างเดียว ไม่มีช่องพิมพ์
 * ฟองข้อความ/การ์ดสินค้าหน้าตาเดียวกับหน้าแชท (ใช้ CSS ของ ai-chat-panel) สินค้าเป็นข้อมูล ณ ตอนที่ AI ตอบ
 * อยากถามต่อ = เริ่มแชทใหม่ที่หน้าแชท (แชทเก่าไม่ถูกต่อ)
 */
@Component({
  selector: 'app-history-chat',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './history-chat.component.html',
  styleUrls: ['../recommendations/ai-chat-panel.component.css', './history-chat.component.css']
})
export class HistoryChatComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly history = inject(HistoryService);
  private readonly userProfile = inject(UserProfileService);

  chat: SavedChat | null = null;
  loading = true;
  /** 'missing' = ไม่พบแชท (ถูกลบ / ไม่ใช่ของผู้ใช้นี้), 'failed' = โหลดไม่สำเร็จ */
  error: 'missing' | 'failed' | null = null;
  userAvatar = DEFAULT_AVATAR;
  avatarFailed = false;

  private chatId = 0;
  private routeSub?: Subscription;
  private profileSub?: Subscription;
  private loadSub?: Subscription;

  ngOnInit(): void {
    this.profileSub = this.userProfile.currentUser$.subscribe(user => this.userAvatar = user?.avatarUrl || DEFAULT_AVATAR);
    this.routeSub = this.route.paramMap.subscribe(params => {
      this.chatId = Number(params.get('id'));
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.profileSub?.unsubscribe();
    this.loadSub?.unsubscribe();
  }

  load(): void {
    this.loadSub?.unsubscribe();
    this.chat = null;
    this.error = null;
    if (!Number.isInteger(this.chatId) || this.chatId <= 0) {
      this.loading = false;
      this.error = 'missing';
      return;
    }
    this.loading = true;
    this.loadSub = this.history.getChat(this.chatId).subscribe({
      next: chat => {
        this.chat = chat;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error = err.status === 404 ? 'missing' : 'failed';
      }
    });
  }

  /** "20 ตุลาคม 2569 เวลา 12:00 น." (เวลาไทย) */
  get startedLabel(): string {
    if (!this.chat) return '';
    const at = new Date(this.chat.startedAt);
    const date = at.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' });
    const time = at.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} เวลา ${time} น.`;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
