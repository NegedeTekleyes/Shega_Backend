import { IsInt, IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { Speciality, TechnicianStatus } from '@prisma/client';

export class CreateTechnicianDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

    @IsEnum(Speciality) 
    @IsOptional()
  speciality: Speciality;

  @IsEnum(TechnicianStatus)
  @IsOptional()
  status?: TechnicianStatus;
}