// src/complaints/dto/create-complaint.dto.ts
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

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  urgency: string;

  @IsOptional()
  locationData?: LocationDataDto;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @IsOptional()
  timestamp?: string;
}