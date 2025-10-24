import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /** Create a notification for target users */
  async create(createDto: CreateNotificationDto, adminId: number) {
    // 1️⃣ Save notification in DB with receipts
    const targetUserIds = createDto.targetUserIds || [];
    const notification = await this.prisma.notification.create({
      data: {
        title: createDto.title,
        message: createDto.message,
        audience: createDto.audience,
        createdById: adminId,
        receipts: {
          create: targetUserIds.map((id) => ({ userId: id })),
        },
      },
      include: { receipts: true },
    });

    // 2️⃣ Emit real-time notification to connected users
    targetUserIds.forEach((userId) => {
      // this.notificationsGateway.sendToUser(userId, 'new-notification', notification);
    });

    // 3️⃣ Notify other connected admins
    // this.notificationsGateway.sendToAdmins('admin-notification', notification);

    return notification;
  }

  /** Get notifications for a specific user */
  async getUserNotifications(userId: number) {
    return this.prisma.notificationReceipt.findMany({
      where: { userId },
      include: { notification: true },
      orderBy: { notification: { createdAt: 'desc' } },
      take: 50,
    });
  }

  /** Mark a notification as read */
  async markAsRead(userId: number, notificationId: number) {
    const receipt = await this.prisma.notificationReceipt.findUnique({
      where: { notificationId_userId: { notificationId, userId } },
    });

    if (!receipt) throw new NotFoundException('Notification not found for this user');

    return this.prisma.notificationReceipt.update({
      where: { id: receipt.id },
      data: { readAt: new Date() },
    });
  }

  /** Update a notification (admin only) */
  async update(notificationId: number, updateDto: UpdateNotificationDto) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: updateDto,
    });
  }

  /** Get statistics */
  async getStats() {
    const total = await this.prisma.notification.count();
    const unread = await this.prisma.notificationReceipt.count({
      where: { readAt: null },
    });

    return { total, unread };
  }
}
