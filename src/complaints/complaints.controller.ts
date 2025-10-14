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
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, ComplaintStatus } from '@prisma/client';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintsService } from './complaints.service';

@Controller('complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  // ==========================================================================
  // SPECIFIC ROUTES (must come BEFORE parameterized routes)
  // ==========================================================================

  // --------------------------------------------------------------------------
  // ADMIN ENDPOINTS
  // --------------------------------------------------------------------------

  @Get()
  @Roles(Role.ADMIN)
  async getAllComplaints(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: ComplaintStatus,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    if (isNaN(pageNum) || isNaN(limitNum)) {
      throw new BadRequestException('Page and limit must be numeric values');
    }
    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    return this.complaintsService.getAllComplaints(pageNum, limitNum, status);
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  async getComplaintStats() {
    return this.complaintsService.getComplaintStats();
  }

  // --------------------------------------------------------------------------
  // RESIDENT ENDPOINTS
  // --------------------------------------------------------------------------

  @Post()
  @Roles(Role.RESIDENT, Role.ADMIN)
  async createComplaint(@Body() dto: CreateComplaintDto, @Request() req) {
    return this.complaintsService.create(req.user.id, dto);
  }

  @Get('my-complaints') // <-- MOVED BEFORE :id route
  @Roles(Role.RESIDENT, Role.ADMIN, Role.TECHNICIAN)
  async getUserComplaints(
    @Request() req,
    @Query('page') page: string | number = 1,
    @Query('limit') limit: string | number = 10,
  ) {
    console.log('📥 Query params received:', { page, limit });

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    if (isNaN(pageNum) || isNaN(limitNum)) {
      throw new BadRequestException('Page and limit must be numeric values');
    }

    const finalPage = Math.max(1, pageNum);
    const finalLimit = Math.min(Math.max(1, limitNum), 100);

    console.log(
      `📤 Fetching complaints for user ${req.user.id}, page: ${finalPage}, limit: ${finalLimit}`,
    );

    return this.complaintsService.findAllByUser(
      req.user.id,
      finalPage,
      finalLimit,
    );
  }

  // --------------------------------------------------------------------------
  // TECHNICIAN ENDPOINTS
  // --------------------------------------------------------------------------

  @Get('technician/assigned')
  @Roles(Role.TECHNICIAN)
  async getAssignedComplaints(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    if (isNaN(pageNum) || isNaN(limitNum)) {
      throw new BadRequestException('Page and limit must be numeric values');
    }
    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    return this.complaintsService.findAssignedComplaints(
      req.user.id,
      pageNum,
      limitNum,
    );
  }

  // ==========================================================================
  // PARAMETERIZED ROUTES (must come AFTER specific routes)
  // ==========================================================================

  @Get(':id') // <-- MOVED TO BOTTOM
  async getComplaintById(@Param('id') id: string, @Request() req) {
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      throw new BadRequestException('Invalid complaint ID');
    }

    const complaint = await this.complaintsService.getComplaintById(complaintId);
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Access control: only admins or complaint owners can access
    if (req.user.role !== Role.ADMIN && complaint.userId !== req.user.id) {
      throw new ForbiddenException('Access denied');
    }

    return complaint;
  }

  @Put(':id/status')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  async updateComplaintStatus(
    @Param('id') id: string,
    @Body() body: { status: ComplaintStatus; adminNotes?: string },
  ) {
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      throw new BadRequestException('Invalid complaint ID');
    }
    if (!body.status) {
      throw new BadRequestException('Status is required');
    }

    return this.complaintsService.updateComplaintStatus(
      complaintId,
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
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      throw new BadRequestException('Invalid complaint ID');
    }
    if (!body.technicianId) {
      throw new BadRequestException('Technician ID is required');
    }

    return this.complaintsService.assignTechnician(
      complaintId,
      body.technicianId,
    );
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteComplaint(@Param('id') id: string) {
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      throw new BadRequestException('Invalid complaint ID');
    }

    await this.complaintsService.deleteComplaint(complaintId);
    return { message: 'Complaint deleted successfully' };
  }
}