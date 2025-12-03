import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TechniciansModule } from './technician/technicians.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
@Module({

  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    ComplaintsModule,
    UsersModule,
    ReportsModule,
    AnalyticsModule,
    TechniciansModule,
    NotificationsModule,
  ],
  providers: [],
  controllers: []
  
  
})
export class AppModule {}
