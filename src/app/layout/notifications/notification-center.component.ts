import { AsyncPipe, NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [AsyncPipe, NgFor],
  template: `
    <section class="notification-center" aria-label="Notifications" aria-live="polite">
      <article
        *ngFor="let notification of notifications.notifications$ | async"
        class="notification"
        [class.notification-success]="notification.type === 'success'"
        [class.notification-error]="notification.type === 'error'"
        [class.notification-info]="notification.type === 'info'"
        [attr.role]="notification.type === 'error' ? 'alert' : 'status'"
      >
        <span class="notification-icon" aria-hidden="true">
          {{ notification.type === 'success' ? '✓' : notification.type === 'error' ? '!' : 'i' }}
        </span>
        <p>{{ notification.message }}</p>
        <button type="button" aria-label="Fermer la notification" (click)="notifications.dismiss(notification.id)">×</button>
      </article>
    </section>
  `,
  styles: [`
    :host { position: fixed; top: 16px; right: 16px; z-index: 2000; width: min(420px, calc(100vw - 32px)); pointer-events: none; }
    .notification-center { display: grid; gap: 10px; }
    .notification { display: flex; align-items: flex-start; gap: 11px; padding: 14px; border: 1px solid #DDE7E1; border-radius: 9px; background: #fff; box-shadow: 0 10px 30px #173a2b24; pointer-events: auto; animation: notification-enter .18s ease-out; }
    .notification-icon { display: grid; place-items: center; flex: 0 0 24px; width: 24px; height: 24px; border-radius: 50%; background: #E8F7EE; color: #16803C; font-size: .85rem; font-weight: 800; }
    .notification p { flex: 1; margin: 2px 0 0; color: #253A31; font-size: .86rem; line-height: 1.45; overflow-wrap: anywhere; }
    .notification button { flex: 0 0 24px; width: 24px; height: 24px; padding: 0; border: 0; background: transparent; color: #718179; font-size: 1.25rem; line-height: 1; cursor: pointer; }
    .notification-error { border-color: #F3C8C4; }
    .notification-error .notification-icon { background: #FCE9E7; color: #B42318; }
    .notification-info .notification-icon { background: #EAF2FF; color: #245DB0; }
    @keyframes notification-enter { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .notification { animation: none; } }
  `],
})
export class NotificationCenterComponent {
  constructor(readonly notifications: NotificationService) {}
}
