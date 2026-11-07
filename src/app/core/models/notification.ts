export type NotificationType = 'success' | 'error' | 'info';

export interface AppNotification {
  id: number;
  type: NotificationType;
  message: string;
}
