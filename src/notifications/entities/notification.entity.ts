// src/notifications/entities/notification.entity.ts
export class Notification {
  id: string; // UUID or string ID
  title: string;
  message: string;
  type: string; // e.g., General, System, Alert, Update, Report
  status: string; // sent, read, unread
  targetUserType: string; // all, resident, technician, specific
  specificUsers?: string[]; // user IDs for specific targeting
  createdBy: string; // admin ID who created the notification
  createdAt: Date;
  updatedAt: Date;
}
