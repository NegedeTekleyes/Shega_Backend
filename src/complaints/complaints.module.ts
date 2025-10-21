import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { AdminApiKeyGuard } from 'src/auth/admin-api-key.guard';

@Module({
  imports: [PrismaModule], // Import PrismaModule to get access to PrismaService
  controllers: [ComplaintsController],
  providers: [ComplaintsService, AdminApiKeyGuard],
  exports: [ComplaintsService], // Optional: export if needed by other modules
})
export class ComplaintsModule {}