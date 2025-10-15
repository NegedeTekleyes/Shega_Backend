import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from 'src/email/email.service';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { EitherAuthGuard } from './either-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:[ConfigService],
      useFactory: (configService: ConfigService)=>({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {expiresIn: '1d'},
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    EmailService,
    AdminApiKeyGuard,
    EitherAuthGuard,
   JwtAuthGuard,
  ],
  exports:[
    AuthService,
    JwtAuthGuard,
    AdminApiKeyGuard,
    EitherAuthGuard,
  ],
  
})
export class AuthModule {}
