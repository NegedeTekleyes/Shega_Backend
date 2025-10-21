import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Speciality, TechnicianStatus } from '@prisma/client';

export class UpdateTechnicianDto {

   @IsEnum(Speciality)  
   @IsOptional()
  speciality: Speciality;

  @IsEnum(TechnicianStatus)
  @IsOptional()
  status?: TechnicianStatus;
}