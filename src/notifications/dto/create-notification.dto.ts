import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { Audience, NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType; // GENERAL, SYSTEM, ALERT, UPDATE, REPORT

  @IsEnum(Audience)
  targetUserType: Audience; // ALL, RESIDENT, TECHNICIAN, SPECIFIC

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  specificUsers?: string[]; // Array of user IDs as strings
}