import { IsInt, IsNotEmpty } from 'class-validator';

export class AssignTechnicianDto {
  @IsInt()
  @IsNotEmpty()
  technicianId: number;
}