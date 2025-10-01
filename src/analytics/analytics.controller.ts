import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(Role.ADMIN)
  async getDashboardData(@Query('days') days: string = '30') {
    const daysNumber = parseInt(days) || 30;
    return this.analyticsService.getComprehensiveAnalytics(daysNumber);
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  async getStats(@Query('days') days: string = '30') {
    const daysNumber = parseInt(days) || 30;
    return this.analyticsService.getDashboardOverview(daysNumber);
  }

  @Get('by-category')
  @Roles(Role.ADMIN)
  async getByCategory() {
    return this.analyticsService.getComplaintsByCategory();
  }

  @Get('by-status')
  @Roles(Role.ADMIN)
  async getByStatus() {
    return this.analyticsService.getComplaintsByStatus();
  }

  @Get('top-technicians')
  @Roles(Role.ADMIN)
  async getTopTechnicians(@Query('limit') limit: string = '3') {
    const limitNumber = parseInt(limit) || 3;
    return this.analyticsService.getTopTechnicians(limitNumber);
  }
}