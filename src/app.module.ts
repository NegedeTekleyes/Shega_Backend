import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';

@Module({

  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    AuthModule,
  ],
  providers: [
    // provide: APP_GUARD,
    // useClass: JwtAuthGuard,
  ]
  
  
})
export class AppModule {}
