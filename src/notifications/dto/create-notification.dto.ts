import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Audience } from '@prisma/client';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(Audience)
  @IsOptional()
  audience?: Audience; // ALL | RESIDENT | TECHNICIAN
  targetUserIds: never[];
}
