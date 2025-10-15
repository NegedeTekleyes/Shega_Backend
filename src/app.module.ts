import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { ComplaintsService } from './complaints/complaints.service';
import { ComplaintsController } from './complaints/complaints.controller';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TechniciansModule } from './technician/technicians.module';
@Module({

  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    ComplaintsModule,
    UsersModule,
    ReportsModule,
    AnalyticsModule,
    TechniciansModule,
  ],
  providers: [
    // provide: APP_GUARD,
    // useClass: JwtAuthGuard,
  ComplaintsService
],
  controllers: [ComplaintsController]
  
  
})
export class AppModule {}
