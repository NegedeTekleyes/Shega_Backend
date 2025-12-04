import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateAdminDto } from './dto/create-admin';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // GET ALL ADMINS
  async findAll() {
    return this.prisma.admin.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            lastLogin: true,
          },
        },
      },
    });
  }

  // GET ONE ADMIN BY ID
  async findOne(id: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  // CREATE ADMIN
  async create(dto: CreateAdminDto) {
    const { name, email, password, phone } = dto;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });

    return this.prisma.admin.create({
      data: {
        name,
        userId: user.id,
      },
      include: { user: true },
    });
  }

  // UPDATE ADMIN
  async update(id: number, dto: UpdateAdminDto) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');

    return this.prisma.admin.update({
      where: { id },
      data: {
        name: dto.name,
        user: {
          update: {
            phone: dto.phone,
          },
        },
      },
      include: { user: true },
    });
  }

  // DELETE ADMIN
  async delete(id: number) {
    return this.prisma.admin.delete({ where: { id } });
  }

  // NEW: GET LOGGED-IN ADMIN PROFILE
  async getProfile(userId: number) {
    // You can replace "1" with data from auth token
    const adminId = 11;

    const admin = await this.prisma.admin.findUnique({
      where: { userId: userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            lastLogin: true,
          },
        },
      },
    });

    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  // NEW: GET DASHBOARD STATS
  async getStats() {
    const adminCount = await this.prisma.admin.count();
    const userCount = await this.prisma.user.count();
    const technicians = await this.prisma.user.count({
      where: { role: Role.TECHNICIAN },
    });
    const complaintsCount = await this.prisma.complaint.count();

    return {
      adminCount,
      userCount,
      technicians,
      complaintsCount,
    };
  }
}
