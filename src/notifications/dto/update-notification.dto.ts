import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Audience } from '@prisma/client';

export class UpdateNotificationDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsEnum(Audience)
  @IsOptional()
  audience?: Audience; // ALL | RESIDENT | TECHNICIAN
}
