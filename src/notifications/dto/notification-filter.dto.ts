// src/notifications/dto/notification-filter.dto.ts
export class NotificationFilterDto {
  page?: number = 1;
  limit?: number = 50;
  type?: string;
  status?: string;
  targetUserType?: string;
}