import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  // namespace: '/notifications',
})
// @WebSocketGateway({
//   // namespace: '/notifications',
//   cors: { origin: 'http://localhost:3001', credentials: true },
// })

export class NotificationsGateway 
implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect 
{
  // notifyAdmins(arg0: { type: string; message: string; notificationId: number; timestamp: Date; }) {
  //   throw new Error('Method not implemented.');
  // }
  // sendNotificationToUsers(recipientUserIds: number[], arg1: { id: number; title: string; message: string; type: $Enums.NotificationType; createdAt: Date; }) {
  //   throw new Error('Method not implemented.');
  // }
  @WebSocketServer() server: Server;
  private logger = new Logger(NotificationsGateway.name);

  private connectedUsers = new Map<number, string>(); // userId -> socketId
  private adminSockets = new Set<string>(); // admin socket IDs

  constructor(
    private readonly prismaService: PrismaService, //Correct: prismaService
  ) {}

  // websocket intialized
  afterInit(server: Server) {
    this.logger.log(' Notifications WebSocket Gateway initialized');
  }

  // when a client connects
  handleConnection(socket: Socket) {
    const apiKey = socket.handshake.headers['x-admin-api-key'] as string;
    const userId = Number(socket.handshake.query.userId);

    // Admin connection
    if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
      this.adminSockets.add(socket.id);
      this.logger.log(` Admin connected via API key: ${socket.id}`);
      return;
    }

    // User connection
    if (userId) {
      this.connectedUsers.set(userId, socket.id);
      this.logger.log(` User ${userId} connected via WebSocket: ${socket.id}`);
      return;
    }

    // Reject if neither admin nor user
    this.logger.warn(` Unauthorized connection: ${socket.id}`);
    socket.disconnect();
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
    this.removeUserBySocketId(socket.id);
    this.adminSockets.delete(socket.id);
  }

  // user rigister for notifications
  @SubscribeMessage('register-user')
  handleRegisterUser(socket: Socket, data: { userId: number; userType: string }) {
    this.connectedUsers.set(data.userId, socket.id);
    this.logger.log(` User ${data.userId} (${data.userType}) registered with socket ${socket.id}`);
    
    socket.emit('registration-success', { 
      message: 'Successfully registered for notifications',
      userId: data.userId
    });
  }

  // admin send notifications
  @SubscribeMessage('send-notification')
  async handleSendNotification(
    socket: Socket,
    data: {
       targetUserIds: number[];
        title: string; 
        message: string; 
        audience: 'ALL' | 'RESIDENT' | 'TECHNICIAN'
       },
  ) {
    // Only admins can send
    if (!this.adminSockets.has(socket.id)) {
      throw new UnauthorizedException('Only admins can send notifications');
    }

    try {
      const notification = await this.prismaService.notification.create({
        data: {
          title: data.title,
          message: data.message,
          audience: data.audience,
          createdById: 1, // replace with real admin ID if you store admins in DB
          receipts: {
            create: data.targetUserIds.map((id) => ({ userId: id })),
          },
        },
        include: { receipts: true },
      });

      // Emit notification to connected users
      let sentCount = 0;
      data.targetUserIds.forEach((userId) => {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
          this.server.to(socketId).emit('new-notification', notification);
          sentCount++;
          this.logger.log(` Notification sent to user ${userId}`);
        }
      });

      // Notify other admins
      this.adminSockets.forEach((adminSocketId) => {
        if (adminSocketId !== socket.id) {
          this.server.to(adminSocketId).emit('admin-notification', {
            ...notification,
            sentCount,
            totalTargets: data.targetUserIds.length,
          });
        }
      });

      this.logger.log(` Notification delivery: ${sentCount}/${data.targetUserIds.length} users`);

      // Send success response to the admin who sent the notification
      socket.emit('notification-sent', {
        success: true,
        notification,
        sentCount,
        totalTargets: data.targetUserIds.length,
      });

      return { success: true, notification, sentCount };

    } catch (error) {
      this.logger.error('Error sending notification:', error);
      socket.emit('notification-error', { error: 'Failed to send notification' });
      throw error;
    }
  }

  //  send to a single user
  public sendToUser(userId: number, event: string, data: any): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      // send in format that frontyed expects
      const message = {
        event: event,
        data: data
      }
      this.server.to(socketId).emit('message', JSON.stringify(message));
      this.logger.log(` Sent ${event} to user ${userId}`);
      return true;
    }
    this.logger.warn(`User ${userId} not connected for event ${event}`);
    return false;
  }

 public sendNotificationToUsers(recipientUserIds: number[], notification: any) {
  let sentCount = 0;

  recipientUserIds.forEach((userId) => {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      const message = {
        event: 'new-notification',
        data: notification
      }
      this.server.to(socketId).emit('message', JSON.stringify(message));
      sentCount++;
      this.logger.log(`Notification sent to user ${userId}`);
    }
  });

  this.logger.log(`Notification delivery: ${sentCount}/${recipientUserIds} users`)

  return { success: true, sentCount };
}


  public sendToAdmins(event: string, data: any) {
    this.adminSockets.forEach(socketId => {
      this.server.to(socketId).emit(event, data);
    });
    this.logger.log(` Sent ${event} to ${this.adminSockets.size} admins`);
  }

  public sendToAllUsers(event: string, data: any) {
    this.connectedUsers.forEach((socketId, userId) => {
      this.server.to(socketId).emit(event, data);
    });
    this.logger.log(`Broadcast ${event} to ${this.connectedUsers.size} users`);
  }

  private removeUserBySocketId(socketId: string) {
    for (const [userId, sId] of this.connectedUsers.entries()) {
      if (sId === socketId) {
        this.connectedUsers.delete(userId);
        this.logger.log(`Removed user ${userId} from connected users`);
        break;
      }
    }
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getConnectedAdminsCount(): number {
    return this.adminSockets.size;
  }

  // Helper method to get user IDs by type
  public getConnectedUserIds(): number[] {
    return Array.from(this.connectedUsers.keys());
  }
}