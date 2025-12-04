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
  Inject,
  forwardRef,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    role: string;
  };
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  // ========================
  // ADMIN ENDPOINTS (API Key)
  // ========================

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

  @Get('users')
  async getUsers(@Request() req) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.getUsers();
  }

  @Post()
  async create(
    @Body() createDto: CreateNotificationDto,
    @Request() req,
  ) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    const adminId = 11; // or fetch admin user via API key
    return this.notificationsService.create(createDto, adminId);
  }

  @Get('stats')
  async getStats(@Request() req) {
    const apiKey = req.headers['x-admin-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.notificationsService.getStats();
  }

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

  // ========================
  // USER ENDPOINTS (JWT Auth)
  // ========================

  @Get('my-notifications')
  @UseGuards(AuthGuard('jwt')) 
  async getMyNotifications(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    
    console.log(`Fetching notifications for user ${userId} (from JWT)`);
    
    return this.notificationsService.getUserNotifications(userId);
  }

  /** 
   * USER: Mark Notification As Read (JWT Protected)
   */
  @Patch('mark-read/:notificationId')
  @UseGuards(AuthGuard('jwt'))
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    
    return this.notificationsService.markAsRead(userId, Number(notificationId));
  }

  // ========================
  // BACKWARD COMPATIBILITY
  // ========================

  @Get('my-notifications-legacy')
  async getMyNotificationsLegacy(@Request() req) {
    const userId = Number(req.query.userId || req.headers['x-user-id']);
    if (!userId) throw new UnauthorizedException('User ID required');

    console.warn('Using legacy endpoint - migrate to JWT auth');
    return this.notificationsService.getUserNotifications(userId);
  }
}