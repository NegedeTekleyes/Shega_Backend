import { IsString, IsNotEmpty, IsOptional, IsEnum, IsEmail } from 'class-validator';
import { Speciality, TechnicianStatus } from '@prisma/client';

export class CreateTechnicianDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(Speciality) 
  @IsOptional()
  speciality?: Speciality;

  @IsEnum(TechnicianStatus)
  @IsOptional()
  status?: TechnicianStatus;
}