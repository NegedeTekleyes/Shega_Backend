// src/complaints/dto/create-complaint.dto.ts
import { ComplaintCategory, Priority } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, IsEnum, ValidateNested } from 'class-validator';

export class LocationDataDto {
  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  accuracy?: number;
}

export class CreateComplaintDto {
  @IsNumber()
  userId: number;

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
  @ValidateNested()
  @Type(() => LocationDataDto)
  locationData?: LocationDataDto;

  @IsArray()
  @IsOptional()
  @IsString({each: true})
  photos?: string[];

  @IsOptional()
  timestamp?: string;
}