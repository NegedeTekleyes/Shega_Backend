import { IsString, IsOptional, IsEnum } from 'class-validator';
import { TechnicianStatus } from '@prisma/client';

export class UpdateTechnicianDto {
  @IsString()
  @IsOptional()
  speciality?: string;

  @IsEnum(TechnicianStatus)
  @IsOptional()
  status?: TechnicianStatus;
}