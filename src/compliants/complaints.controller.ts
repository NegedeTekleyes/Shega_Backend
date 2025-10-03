// src/complaints/complaints.controller.ts
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
  Request, 
  NotFoundException
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, ComplaintStatus } from '@prisma/client';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintsService } from './complaints.service';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  // ADMIN ONLY ENDPOINTS

  @Get()
  @Roles(Role.ADMIN)
  async getAllComplaints(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: ComplaintStatus,
  ) {
    return this.complaintsService.getAllComplaints(
      parseInt(page),
      parseInt(limit),
      status,
    );
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  async getComplaintStats() {
    return this.complaintsService.getComplaintStats();
  }

  @Get(':id')
  async getComplaintById(@Param('id') id: string, @Request() req) {
    const complaint = await this.complaintsService.getComplaintById(parseInt(id));
    
    // If user is not admin, check if they own the complaint
    if (req.user.role !== Role.ADMIN && complaint.user.id !== req.user.id) {
      throw new NotFoundException('Complaint not found');
    }
    
    return complaint;
  }

  @Put(':id/status')
  @Roles(Role.ADMIN)
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body() body: { status: ComplaintStatus; adminNotes?: string },
  ) {
    return this.complaintsService.updateComplaintStatus(
      parseInt(id),
      body.status,
      body.adminNotes,
    );
  }

  @Put(':id/assign')
  @Roles(Role.ADMIN)
  async assignTechnician(
    @Param('id') id: string,
    @Body() body: { technicianId: number },
  ) {
    return this.complaintsService.assignTechnician(
      parseInt(id),
      body.technicianId,
    );
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteComplaint(@Param('id') id: string) {
    await this.complaintsService.deleteComplaint(parseInt(id));
    return { message: 'Complaint deleted successfully' };
  }

  // RESIDENT ENDPOINTS

  @Post()
  @Roles(Role.RESIDENT)
  async createComplaint(@Body() dto: CreateComplaintDto, @Request() req) {
    return this.complaintsService.create(req.user.id, dto);
  }

  @Get('user/my-complaints')
  @Roles(Role.RESIDENT)
  async getUserComplaints(@Request() req) {
    return this.complaintsService.findAllByUser(req.user.id);
  }

  @Get('user/:id')
  @Roles(Role.RESIDENT)
  async getUserComplaint(@Param('id') id: string, @Request() req) {
    return this.complaintsService.findOneByUser(parseInt(id), req.user.id);
  }
}