// // src/technicians/technicians.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TechniciansController } from './technician.controller';
import { TechniciansService } from './technician.service';

@Module({
  imports: [PrismaModule],
  controllers: [TechniciansController],
  providers: [TechniciansService],
  exports: [TechniciansService],
})
export class TechniciansModule {}