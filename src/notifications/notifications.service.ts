// notifications.service.ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { Audience, NotificationType, ReceiptStatus, Role } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /** ========================
   * Get All Notifications (Admin)
   * ======================== */
  async getAllNotifications(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { 
            select: { 
              id: true, 
              name: true, 
              email: true 
            } 
          },
          receipts: {
            include: { 
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true
                }
              } 
            }
          }
        }
      }),
      this.prisma.notification.count()
    ]);

    // Format for frontend
    const formattedNotifications = notifications.map(notif => ({
      id: notif.id.toString(),
      title: notif.title,
      message: notif.message,
      type: notif.type,
      status: 'Sent', // Default status for admin view
      date: notif.createdAt.toISOString().slice(0, 10),
      targetUserType: notif.audience,
      specificUsers: notif.receipts.map(r => r.userId.toString()),
      createdAt: notif.createdAt
    }));

    return {
      notifications: formattedNotifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /** ========================
   * Get Users List
   * ======================== */
  async getUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        role: {
          in: [Role.RESIDENT, Role.TECHNICIAN]
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format for frontend - convert role to type
    return users.map(user => ({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      type: user.role.toLowerCase() as 'resident' | 'technician'
    }));
  }

  /** ========================
   * Create Notification
   * ======================== */
  async create(createDto: CreateNotificationDto, adminId: number) {
    const { title, message, type, targetUserType, specificUsers = [] } = createDto;

    // Determine which users should receive this notification
    let recipientUserIds: number[] = [];

    if (targetUserType === Audience.SPECIFIC) {
      // Use specific user IDs provided
      recipientUserIds = specificUsers.map(id => parseInt(id));
    } else if (targetUserType === Audience.RESIDENT) {
      // Get all residents
      const residents = await this.prisma.user.findMany({
        where: { role: Role.RESIDENT },
        select: { id: true }
      });
      recipientUserIds = residents.map(user => user.id);
    } else if (targetUserType === Audience.TECHNICIAN) {
      // Get all technicians
      const technicians = await this.prisma.user.findMany({
        where: { role: Role.TECHNICIAN },
        select: { id: true }
      });
      recipientUserIds = technicians.map(user => user.id);
    } else {
      // 'ALL' - get all users (excluding other admins)
      const allUsers = await this.prisma.user.findMany({
        where: {
          role: {
            in: [Role.RESIDENT, Role.TECHNICIAN]
          }
        },
        select: { id: true }
      });
      recipientUserIds = allUsers.map(user => user.id);
    }

    // Create notification in database
    const notification = await this.prisma.notification.create({
      data: {
        title,
        message,
        type: type || NotificationType.GENERAL,
        audience: targetUserType,
        createdById: adminId,
        receipts: {
          create: recipientUserIds.map(userId => ({
            userId,
            status: ReceiptStatus.UNREAD
          }))
        }
      },
      include: {
        receipts: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Send real-time notification via WebSocket
    // await this.notificationsGateway.sendNotificationToUsers(
    //   recipientUserIds,
    //   {
    //     id: notification.id,
    //     title: notification.title,
    //     message: notification.message,
    //     type: notification.type,
    //     createdAt: notification.createdAt
    //   }
    // );

    // // Also notify other admins
    // this.notificationsGateway.notifyAdmins({
    //   type: 'NEW_NOTIFICATION',
    //   message: `New notification sent: ${title}`,
    //   notificationId: notification.id,
    //   timestamp: new Date()
    // });

    return notification;
  }

  /** ========================
   * Get Stats
   * ======================== */
  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalNotifications,
      sentToday,
      totalUsers,
      residentsCount,
      techniciansCount,
      totalReceipts,
      readReceipts
    ] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      this.prisma.user.count({
        where: {
          role: {
            in: [Role.RESIDENT, Role.TECHNICIAN]
          }
        }
      }),
      this.prisma.user.count({ where: { role: Role.RESIDENT } }),
      this.prisma.user.count({ where: { role: Role.TECHNICIAN } }),
      this.prisma.notificationReceipt.count(),
      this.prisma.notificationReceipt.count({
        where: { status: ReceiptStatus.READ }
      })
    ]);

    return {
      total: totalNotifications,
      unread: totalReceipts - readReceipts,
      read: readReceipts,
      sentToday,
      totalUsers,
      residentsCount,
      techniciansCount
    };
  }

  /** ========================
   * Get User Notifications
   * ======================== */
  async getUserNotifications(userId: number) {
    const notificationReceipts = await this.prisma.notificationReceipt.findMany({
      where: { userId },
      include: {
        notification: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        notification: {
          createdAt: 'desc'
        }
      }
    });

    return notificationReceipts.map(receipt => ({
      id: receipt.notification.id.toString(),
      title: receipt.notification.title,
      message: receipt.notification.message,
      type: receipt.notification.type,
      status: receipt.status.toLowerCase(), // Convert to lowercase for frontend
      date: receipt.notification.createdAt.toISOString().slice(0, 10),
      createdAt: receipt.notification.createdAt,
      readAt: receipt.readAt
    }));
  }

  /** ========================
   * Mark as Read
   * ======================== */
  async markAsRead(userId: number, notificationId: number) {
    return this.prisma.notificationReceipt.update({
      where: {
        notificationId_userId: {
          userId,
          notificationId
        }
      },
      data: {
        status: ReceiptStatus.READ,
        readAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /** ========================
   * Update Notification
   * ======================== */
  async update(notificationId: number, updateDto: UpdateNotificationDto) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        ...updateDto,
        updatedAt: new Date()
      }
    });
  }

  /** ========================
   * Get Unread Count for User
   * ======================== */
  async getUnreadCount(userId: number) {
    return this.prisma.notificationReceipt.count({
      where: {
        userId,
        status: ReceiptStatus.UNREAD
      }
    });
  }
}