// src/complaints/dto/create-complaint.dto.ts
import { 
  IsNotEmpty, 
  IsString, 
  IsOptional, 
  IsArray, 
  IsNumber, 
  IsEnum,
  ValidateNested,
  IsLatitude,
  IsLongitude,
  IsISO8601
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDataDto {
  @IsNumber()
  @IsNotEmpty()
  @IsLatitude()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  accuracy?: number;
}

export class CreateComplaintDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsEnum(['low', 'medium', 'high', 'emergency'])
  urgency: 'low' | 'medium' | 'high' | 'emergency';

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LocationDataDto)
  locationData: LocationDataDto;

  @IsArray()
  @IsOptional()
  photos?: string[];

  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}