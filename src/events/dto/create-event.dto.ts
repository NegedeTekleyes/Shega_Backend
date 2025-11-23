import { IsString, IsNotEmpty, IsOptional, IsDate, IsEnum, IsArray, IsInt } from 'class-validator';
import { EventType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  @Type(() => Date)
  start: Date;

  @IsDate()
  @Type(() => Date)
  end: Date;

  @IsEnum(EventType)
  @IsNotEmpty()
  type: EventType;

  @IsInt()
  @IsOptional()
  technicianId?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  participantIds?: number[];

  @IsString()
  @IsOptional()
  recurrenceRule?: string;
}