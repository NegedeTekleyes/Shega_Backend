import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Audience, NotificationType } from '@prisma/client';

export class UpdateNotificationDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsEnum(Audience)
  @IsOptional()
  audience?: Audience;
}