import { IsString, IsOptional, IsDate, IsEnum, IsArray, IsInt } from 'class-validator';
import { EventType, EventStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  start?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  end?: Date;

  @IsEnum(EventType)
  @IsOptional()
  type?: EventType;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

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