import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompliantsService } from './compliants.service';
import { CompliantsController } from './compliants.controller';

@Module({
  imports: [PrismaModule], // Import PrismaModule to get access to PrismaService
  controllers: [CompliantsController],
  providers: [CompliantsService],
  exports: [CompliantsService], // Optional: export if needed by other modules
})
export class ComplaintsModule {}