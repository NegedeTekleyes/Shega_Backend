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
   * Admin: Create Notification
   * ======================== */
  @Post()
  async create(
    @Body() createDto: CreateNotificationDto,
    @Request() req,
  ) {
    // Admin API key from headers
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Admin ID can be hardcoded or fetched from DB
    const adminId = 1; // or fetch admin user via API key
    return this.notificationsService.create(createDto, adminId);
  }

  /** ========================
   * User: Fetch My Notifications
   * ======================== */
  @Get('my-notifications')
  async getMyNotifications(@Request() req) {
    // For simplicity, user ID is passed as query param or in headers
    const userId = Number(req.query.userId || req.headers['x-user-id']);
    if (!userId) throw new UnauthorizedException('User ID required');

    return this.notificationsService.getUserNotifications(userId);
  }

  /** ========================
   * User: Mark Notification As Read
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
   * Admin: Update Notification
   * ======================== */
  @Patch(':notificationId')
  async update(
    @Param('notificationId') notificationId: string,
    @Body() updateDto: UpdateNotificationDto,
    @Request() req,
  ) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.update(Number(notificationId), updateDto);
  }

  /** ========================
   * Admin: Get Stats
   * ======================== */
  @Get('stats')
  async getStats(@Request() req) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.getStats();
  }
}
