import { Component, Input } from '@angular/core';

let nextId = 0;

/** รูปประจำตัว AI (วงกรมท่า + ประกายดาวไล่สี) แบบเดียวกับแชท AI แนะนำ — gradient id ไม่ซ้ำกันต่อชิ้น */
@Component({
  selector: 'app-ai-avatar',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7dd3fc" /><stop offset="1" stop-color="#a78bfa" />
        </linearGradient>
      </defs>
      <path [attr.fill]="'url(#' + gradientId + ')'"
        d="M12 2.5c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z" />
    </svg>`,
  styles: [`
    :host { display: grid; place-items: center; flex: 0 0 auto; width: var(--size, 38px); height: var(--size, 38px);
      border-radius: 50%; background: #1c316f; }
    svg { width: 58%; height: 58%; }
  `]
})
export class AiAvatarComponent {
  @Input() size = 38;
  readonly gradientId = `ai-spark-${++nextId}`;
}
