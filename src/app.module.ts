import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ComplaintsModule } from './compliants/complaints.module';
import {CompliantsService} from 'src/compliants/compliants.service'
import {CompliantsController}  from 'src/compliants/compliants.controller'
@Module({

  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
    ComplaintsModule,
  ],
  providers: [
    // provide: APP_GUARD,
    // useClass: JwtAuthGuard,
  CompliantsService
],
  controllers: [CompliantsController]
  
  
})
export class AppModule {}
