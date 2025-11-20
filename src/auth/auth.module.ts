import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from 'src/email/email.service';

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
  providers: [AuthService,
    PrismaService,
    EmailService,
    JwtStrategy
  ],
  exports:[AuthService,EmailService]
  
})
export class AuthModule {}
