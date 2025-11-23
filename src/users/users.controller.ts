// src/users/users.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('available')
  @Roles(Role.ADMIN)
  async getAvailableUsers() {
    // Get users who are not already technicians and can become technicians
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.RESIDENT] }, // Only residents can become technicians
        technician: null, // Not already a technician
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return users;
  }
}