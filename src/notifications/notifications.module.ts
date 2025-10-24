// src/notifications/notifications.module.ts (Simplified)
import { forwardRef, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  // imports: [PrismaModule, forwardRef(() => NotificationsModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, PrismaService],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}