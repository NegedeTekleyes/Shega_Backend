// src/technicians/technicians.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Query, 
  Body, 
  UseGuards,
  UsePipes,
  ValidationPipe 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { TechniciansService } from './technicians.service';
import { AdminApiKeyGuard } from 'src/auth/admin-api-key.guard';

@Controller('technicians')
@UseGuards(AdminApiKeyGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get()
  @Roles(Role.ADMIN)
  async getAllTechnicians(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: string,
  ) {
    return this.techniciansService.getAllTechnicians(
      parseInt(page),
      parseInt(limit),
      status,
    );
  }

  @Get('available')
  @Roles(Role.ADMIN)
  async getAvailableTechnicians() {
    return this.techniciansService.getAvailableTechnicians();
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  async getTechnicianStats() {
    return this.techniciansService.getTechnicianStats();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async getTechnicianById(@Param('id') id: string) {
    return this.techniciansService.getTechnicianById(parseInt(id));
  }

  @Post()
  @Roles(Role.ADMIN)
  async createTechnician(@Body() createTechnicianDto: CreateTechnicianDto) {
    return this.techniciansService.createTechnician(createTechnicianDto);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  async updateTechnician(
    @Param('id') id: string,
    @Body() updateTechnicianDto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.updateTechnician(parseInt(id), updateTechnicianDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteTechnician(@Param('id') id: string) {
    return this.techniciansService.deleteTechnician(parseInt(id));
  }
  @Post(':id/reset-password')
@Roles(Role.ADMIN)
async resetTechnicianPassword(
  @Param('id') id: string,
  @Body() body: { password: string },
) {
  return this.techniciansService.resetTechnicianPassword(parseInt(id), body.password);
}
}