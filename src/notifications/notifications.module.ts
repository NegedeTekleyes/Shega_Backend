import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule], // <- use PrismaModule to get PrismaService
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway], // <- remove PrismaService here
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
