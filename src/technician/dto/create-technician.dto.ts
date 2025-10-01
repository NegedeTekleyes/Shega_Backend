import { IsInt, IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { TechnicianStatus } from '@prisma/client';

export class CreateTechnicianDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  speciality: string;

  @IsEnum(TechnicianStatus)
  @IsOptional()
  status?: TechnicianStatus;
}