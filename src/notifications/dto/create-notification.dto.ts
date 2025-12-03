import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { Audience, NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType; 

  @IsEnum(Audience)
  targetUserType: Audience; 

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  specificUsers?: string[]; 
}