// src/complaints/dto/create-complaint.dto.ts
import { ComplaintCategory, Priority } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, IsEnum } from 'class-validator';

export class LocationDataDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  accuracy?: number;
}

export class CreateComplaintDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ComplaintCategory)
  category: ComplaintCategory

 @IsEnum(Priority)
 urgency: Priority

  @IsOptional()
  locationData?: LocationDataDto;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @IsOptional()
  timestamp?: string;
}