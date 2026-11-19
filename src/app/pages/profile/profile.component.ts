import { Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeleteAccountComponent } from '../../components/delete-account/delete-account.component';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, finalize } from 'rxjs';
import { CurrentUser, UserProfileService } from '../../services/user-profile/user-profile.service';
import { AuthModalService } from '../../services/auth-modal/auth-modal.service';
import { DEFAULT_AVATAR } from '../../components/user-menu/user-menu.component';
import { getUsernameError } from '../../validators/auth.validators';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_TYPE_ERROR = 'รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WebP';
export const AVATAR_SIZE_ERROR = 'ไฟล์รูปต้องมีขนาดไม่เกิน 5 MB';
export const USERNAME_TAKEN = 'ชื่อผู้ใช้นี้ถูกใช้แล้ว';

/**
 * หน้าโปรไฟล์ (/profile, ต้องล็อกอิน)
 *  - รูปโปรไฟล์: ปุ่มดินสอ -> เลือกไฟล์ -> พรีวิววงกลม -> บันทึก (อัปโหลดผ่าน backend ไป Cloudinary)
 *  - UserName: แก้ในที่ (Enter = บันทึก, Esc = ยกเลิก)
 *  - Email / Password: เปิด popup ของแต่ละงาน (auth-modal-host — มี popup เปิดได้ทีละอันเสมอ)
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, DeleteAccountComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private readonly users = inject(UserProfileService);
  private readonly authModal = inject(AuthModalService);
  private readonly injector = inject(Injector);

  user: CurrentUser | null = null;
  avatarFailed = false;

  // รูปโปรไฟล์
  previewUrl: string | null = null;
  private selectedFile: File | null = null;
  avatarError = '';
  uploading = false;

  // UserName
  editingUsername = false;
  usernameDraft = '';
  usernameError = '';
  savingUsername = false;

  private sub = new Subscription();

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('usernameInput') private usernameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('editUsernameButton') private editUsernameButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('pencilButton') private pencilButton?: ElementRef<HTMLButtonElement>;

  ngOnInit(): void {
    this.sub.add(this.users.currentUser$.subscribe(user => {
      this.user = user;
      this.avatarFailed = false;
    }));
    this.users.loadCurrentUser();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.revokePreview();
  }

  get avatarSrc(): string {
    return this.previewUrl || (!this.avatarFailed && this.user?.avatarUrl) || DEFAULT_AVATAR;
  }

  get hasPreview(): boolean {
    return !!this.previewUrl;
  }

  // ===== รูปโปรไฟล์ =====

  chooseAvatar(): void {
    if (this.uploading) return;
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // ล้างค่าไว้ เลือกไฟล์เดิมซ้ำได้อีก
    input.value = '';
    if (!file) return;

    this.avatarError = '';
    if (!AVATAR_TYPES.includes(file.type)) {
      this.avatarError = AVATAR_TYPE_ERROR;
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.avatarError = AVATAR_SIZE_ERROR;
      return;
    }
    this.revokePreview();
    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  saveAvatar(): void {
    if (!this.selectedFile || this.uploading) return;
    this.uploading = true;
    this.avatarError = '';
    this.users.uploadAvatar(this.selectedFile).pipe(finalize(() => (this.uploading = false))).subscribe({
      next: () => {
        this.selectedFile = null;
        this.revokePreview();
        this.focusLater(() => this.pencilButton?.nativeElement.focus());
      },
      error: (err: HttpErrorResponse) => {
        this.avatarError = err.status === 0 ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
          : err.error?.message || 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      }
    });
  }

  cancelAvatar(): void {
    if (this.uploading) return;
    this.selectedFile = null;
    this.avatarError = '';
    this.revokePreview();
    this.focusLater(() => this.pencilButton?.nativeElement.focus());
  }

  onAvatarError(): void {
    if (!this.previewUrl) this.avatarFailed = true;
  }

  // ===== UserName =====

  startEditUsername(): void {
    this.editingUsername = true;
    this.usernameDraft = this.user?.username ?? '';
    this.usernameError = '';
    this.focusLater(() => {
      this.usernameInput?.nativeElement.focus();
      this.usernameInput?.nativeElement.select();
    });
  }

  onUsernameInput(event: Event): void {
    this.usernameDraft = (event.target as HTMLInputElement).value;
  }

  onUsernameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveUsername();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelUsername();
    }
  }

  saveUsername(): void {
    if (this.savingUsername) return;
    const username = this.usernameDraft.trim();
    this.usernameError = getUsernameError(username) ?? '';
    if (this.usernameError) {
      this.usernameInput?.nativeElement.focus();
      return;
    }
    if (username === this.user?.username) {
      this.closeUsernameEditor();
      return;
    }
    this.savingUsername = true;
    this.users.changeUsername(username).pipe(finalize(() => (this.savingUsername = false))).subscribe({
      next: () => this.closeUsernameEditor(),
      error: (err: HttpErrorResponse) => {
        this.usernameError = err.error?.code === 'USERNAME_TAKEN' ? USERNAME_TAKEN
          : err.status === 400 && err.error?.message ? err.error.message
          : err.status === 0 ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
          : 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
        this.usernameInput?.nativeElement.focus();
      }
    });
  }

  cancelUsername(): void {
    if (this.savingUsername) return;
    this.closeUsernameEditor();
  }

  // ===== Email / Password =====

  editEmail(): void {
    this.authModal.open('email-change');
  }

  changePassword(): void {
    this.authModal.open('password-change');
  }

  // ===== ช่วย =====

  private closeUsernameEditor(): void {
    this.editingUsername = false;
    this.usernameError = '';
    this.focusLater(() => this.editUsernameButton?.nativeElement.focus());
  }

  private focusLater(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }

  private revokePreview(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }
}
