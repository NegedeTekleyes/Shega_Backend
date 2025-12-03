// src/admin/admin.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin';
import { UpdateAdminDto } from './dto/update-admin.dto';

import { AdminApiKeyGuard } from 'src/auth/admin-api-key.guard'; 
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from '@prisma/client';


@Controller('admin')
@UseGuards(AdminApiKeyGuard, RolesGuard) 
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 1. Static Route: /admin/profile (Specific, must be early)
  @Get('profile')
  @Roles(Role.ADMIN) 
  async getProfile(@Request() req) {
    return this.adminService.getProfile(req.user.id);
  }

  // 2. Static Route: /admin/stats (Specific, must be early)
  @Get('stats')
  @Roles(Role.ADMIN) 
  async getStats() {
    return this.adminService.getStats();
  }
  
  // 3. Static Route: /admin (Least specific static route, can follow more specific ones)
  @Get()
  @Roles(Role.ADMIN) 
  async getAllAdmins() {
    return this.adminService.findAll();
  }

  @Get(':id') 
  @Roles(Role.ADMIN)
  async getAdminById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminDto,
  ) {
    return this.adminService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.delete(id);
  }
}