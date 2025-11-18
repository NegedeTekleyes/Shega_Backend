// notifications.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Request,
  UnauthorizedException,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /** ========================
   * ADMIN: Get All Notifications (with pagination)
   * ======================== */
  @Get()
  async getAllNotifications(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Request() req,
  ) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.getAllNotifications(
      Number(page), 
      Number(limit)
    );
  }

  /** ========================
   * ADMIN: Get Users List
   * ======================== */
  @Get('users')
  async getUsers(@Request() req) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.getUsers();
  }

  /** ========================
   * ADMIN: Create Notification
   * ======================== */
  @Post()
  async create(
    @Body() createDto: CreateNotificationDto,
    @Request() req,
  ) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    const adminId = 2; // or fetch admin user via API key
    return this.notificationsService.create(createDto, adminId);
  }

  /** ========================
   * ADMIN: Get Stats
   * ======================== */
  @Get('stats')
  async getStats(@Request() req) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.getStats();
  }

  /** ========================
   * USER: Fetch My Notifications
   * ======================== */
  @Get('my-notifications')
  async getMyNotifications(@Request() req) {
    const userId = Number(req.query.userId || req.headers['x-user-id']);
    if (!userId) throw new UnauthorizedException('User ID required');

    return this.notificationsService.getUserNotifications(userId);
  }

  /** ========================
   * USER: Mark Notification As Read
   * ======================== */
  @Patch('mark-read/:notificationId')
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @Request() req,
  ) {
    const userId = Number(req.query.userId || req.headers['x-user-id']);
    if (!userId) throw new UnauthorizedException('User ID required');

    return this.notificationsService.markAsRead(userId, Number(notificationId));
  }

  /** ========================
   * ADMIN: Update Notification
   * ======================== */
  @Patch(':notificationId')
  async update(
    @Param('notificationId') notificationId: string,
    @Body() updateDto: UpdateNotificationDto,
    @Request() req,
  ) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.update(Number(notificationId), updateDto);
  }
}