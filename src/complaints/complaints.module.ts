import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';
import { AdminApiKeyGuard } from 'src/auth/admin-api-key.guard';

@Module({
  imports: [PrismaModule], 
  controllers: [ComplaintsController],
  providers: [ComplaintsService, AdminApiKeyGuard],
  exports: [ComplaintsService], 
})
export class ComplaintsModule {}