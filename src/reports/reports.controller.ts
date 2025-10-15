// src/reports/reports.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

class GenerateReportDto {
  title: string;
  type: string;
  filters: any;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  @Roles(Role.ADMIN)
  async generateReport(@Body() generateReportDto: GenerateReportDto, @Request() req) {
    const { title, type, filters } = generateReportDto;
    const { startDate, endDate, technicianId } = filters;

    let reportData;

    switch (type) {
      case 'ANALYTICS':
        reportData = await this.reportsService.generateAnalyticsReport(
          new Date(startDate),
          new Date(endDate),
          req.user.id,
        );
        break;
      case 'TECHNICIAN':
        reportData = await this.reportsService.generateTechnicianReport(
          technicianId,
          new Date(startDate),
          new Date(endDate),
          req.user.id,
        );
        break;
      case 'FINANCIAL':
        reportData = await this.reportsService.generateFinancialReport(
          new Date(startDate),
          new Date(endDate),
          req.user.id,
        );
        break;
      default:
        throw new Error('Invalid report type');
    }

    // Save the report
    const savedReport = await this.reportsService.saveReport({
      title,
      type: type as any,
      filters,
      generatedBy: req.user.id,
    }, reportData);

    return {
      ...savedReport,
      data: reportData,
    };
  }

 @Get('analytics')
@Roles(Role.ADMIN)
async getAnalyticsReport(
  @Query('startDate') startDate: string,
  @Query('endDate') endDate: string,
  @Request() req,
): Promise<any> { // Change return type to 'any' to avoid the type naming issue
  if (!startDate || !endDate) {
    throw new BadRequestException('startDate and endDate are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestException('Invalid date format');
  }

  return this.reportsService.generateAnalyticsReport(
    start,
    end,
    req.user.id,
  );
}

  @Get('technician/:id')
  @Roles(Role.ADMIN)
  async getTechnicianReport(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.generateTechnicianReport(
      parseInt(id),
      new Date(startDate),
      new Date(endDate),
      1, // System user
    );
  }

  @Get()
  @Roles(Role.ADMIN)
  async getSavedReports(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.reportsService.getSavedReports(
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async getReportById(@Param('id') id: string) {
    return this.reportsService.getReportById(parseInt(id));
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  async deleteReport(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
) {
    return this.reportsService.deleteReport(id, req.user.id);
  }
}