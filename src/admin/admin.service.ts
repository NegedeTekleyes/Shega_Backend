import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateAdminDto } from './dto/create-admin';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.admin.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            // bio: true,
            lastLogin: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async create(dto: CreateAdminDto) {
    const { name, email, password, phone } = dto;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: 'ADMIN',
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

  async update(id: number, dto: UpdateAdminDto) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');

    return this.prisma.admin.update({
      where: { id },
      data: {
        name: dto.name,
        user: {
          update: {
            // bio: dto.bio,
            phone: dto.phone,
          },
        },
      },
      include: { user: true },
    });
  }

  async delete(id: number) {
    return this.prisma.admin.delete({ where: { id } });
  }
}
