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
  ValidationPipe, 
  Req,
  Patch
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { TechniciansService } from './technicians.service';
import { AdminApiKeyGuard } from 'src/auth/admin-api-key.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';

@Controller('technicians')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  // ==================== ADMIN ENDPOINTS ====================
  @Get()
  @UseGuards(AdminApiKeyGuard)
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
  @UseGuards(AdminApiKeyGuard)
  @Roles(Role.ADMIN)
  async getAvailableTechnicians() {
    return this.techniciansService.getAvailableTechnicians();
  }

  @Get('stats')
  @UseGuards(AdminApiKeyGuard)
  @Roles(Role.ADMIN)
  async getTechnicianStats() {
    return this.techniciansService.getTechnicianStats();
  }

  @Get(':id')
  @UseGuards(AdminApiKeyGuard)
  @Roles(Role.ADMIN)
  async getTechnicianById(@Param('id') id: string) {
    return this.techniciansService.getTechnicianById(parseInt(id));
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  @Roles(Role.ADMIN)
  async createTechnician(@Body() createTechnicianDto: CreateTechnicianDto) {
    return this.techniciansService.createTechnician(createTechnicianDto);
  }

  @Put(':id')
  @UseGuards(AdminApiKeyGuard)
  @Roles(Role.ADMIN)
  async updateTechnician(
    @Param('id') id: string,
    @Body() updateTechnicianDto: UpdateTechnicianDto,
  ) {
    return this.techniciansService.updateTechnician(parseInt(id), updateTechnicianDto);
  }

  @Delete(':id')
  @UseGuards(AdminApiKeyGuard)
  @Roles(Role.ADMIN)
  async deleteTechnician(@Param('id') id: string) {
    return this.techniciansService.deleteTechnician(parseInt(id));
  }

  @Post(':id/reset-password')
  @UseGuards(AdminApiKeyGuard)
  @Roles(Role.ADMIN)
  async resetTechnicianPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.techniciansService.resetTechnicianPassword(parseInt(id), body.password);
  }

  // ==================== TECHNICIAN ENDPOINTS ====================
  
  // Get technician's own tasks
  @Get('my-tasks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TECHNICIAN)
  async getMyTasks(@Req() req: any) {
    const technician = await this.techniciansService.getTechnicianByUserId(req.user.id);
    return this.techniciansService.getTasksByTechnician(technician.id);
  }

  // Get specific task detail
  @Get('task/:complaintId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TECHNICIAN)
  async getTaskDetail(@Param('complaintId') complaintId: string, @Req() req: any) {
    const technician = await this.techniciansService.getTechnicianByUserId(req.user.id);
    return this.techniciansService.getTaskDetail(parseInt(complaintId), technician.id);
  }

  // Update task status
  @Patch('task/:complaintId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TECHNICIAN)
  async updateTaskStatus(
    @Param('complaintId') complaintId: string,
    @Body() body: { status: string; hoursWorked?: number; workDate?: string; note?: string },
    @Req() req,
  ) {
    const technician = await this.techniciansService.getTechnicianByUserId(req.user.id);

    
    return this.techniciansService.updateTaskStatus(
      parseInt(complaintId), 
      technician.id, 
      body
    );
  }

  // Get technician's own profile
  @Get('profile/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TECHNICIAN)
  async getMyProfile(@Req() req: any) {
    return this.techniciansService.getTechnicianByUserId(req.user.id);
  }
}