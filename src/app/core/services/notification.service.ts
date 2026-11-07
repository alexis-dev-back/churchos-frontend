import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppNotification, NotificationType } from '../models/notification';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notifications = new BehaviorSubject<AppNotification[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 0;
  readonly notifications$ = this.notifications.asObservable();

  showSuccess(message: string): void {
    this.show(message, 'success');
  }

  showError(message: string): void {
    this.show(message, 'error');
  }

  showInfo(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.notifications.next(this.notifications.value.filter((notification) => notification.id !== id));
  }

  private show(message: string, type: NotificationType): void {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const id = ++this.nextId;
    this.notifications.next([...this.notifications.value, { id, type, message: trimmedMessage }]);
    const duration = type === 'error' ? 8000 : 5000;
    this.timers.set(id, setTimeout(() => this.dismiss(id), duration));
  }
}
