// src/technicians/technicians.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TechnicianStatus, Role, Speciality } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Update the interface to match what you're actually using
interface CreateTechnicianDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  speciality?: Speciality;
  status?: TechnicianStatus;
}

interface UpdateTechnicianDto {
  speciality?: Speciality;
  status?: TechnicianStatus;
}

@Injectable()
export class TechniciansService  {
  constructor(private prisma: PrismaService) {}

  // Get all technicians with stats
  async getAllTechnicians(
    page: number = 1, 
    limit: number = 10,
    status?: string
  ) {
    const skip = (page - 1) * limit;
    
    const where = status ? { status: status as TechnicianStatus } : {};
    
    const [technicians, total] = await Promise.all([
      this.prisma.technician.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              lastLogin: true,
              createdAt: true,
            },
          },
          tasks: {
            include: {
              complaint: {
                select: {
                  id: true,
                  status: true,
                  category: true,
                  urgency: true,
                },
              },
            },
          },
        },
        orderBy: { user: { name: 'asc' } },
        skip,
        take: limit,
      }),
      this.prisma.technician.count({ where }),
    ]);

    // Calculate performance stats for each technician
    const techniciansWithStats = technicians.map(tech => {
      const completedTasks = tech.tasks.filter(task => 
        task.complaint.status === 'RESOLVED'
      );
      const activeTasks = tech.tasks.filter(task => 
        task.complaint.status === 'ASSIGNED' || task.complaint.status === 'IN_PROGRESS'
      );

      const efficiency = tech.tasks.length > 0 
        ? (completedTasks.length / tech.tasks.length) * 100 
        : 0;

      return {
        ...tech,
        stats: {
          totalTasks: tech.tasks.length,
          completedTasks: completedTasks.length,
          activeTasks: activeTasks.length,
          efficiency: Math.round(efficiency),
        },
      };
    });

    return {
      technicians: techniciansWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Get technician by ID
  async getTechnicianById(id: number) {
    const technician = await this.prisma.technician.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            lastLogin: true,
            createdAt: true,
          },
        },
        tasks: {
          include: {
            complaint: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${id} not found`);
    }

    return technician;
  }

  // Create new technician with user account
  async createTechnician(createTechnicianDto: CreateTechnicianDto) {
    const { name, email, password, phone, speciality, status } = createTechnicianDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        role: Role.TECHNICIAN,
      },
    });

    // Create technician record
    return this.prisma.technician.create({
      data: {
        userId: user.id,
        speciality: speciality || null,
        status: status || TechnicianStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  // Update technician
  async updateTechnician(id: number, updateTechnicianDto: UpdateTechnicianDto) {
    const technician = await this.prisma.technician.findUnique({
      where: { id },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${id} not found`);
    }

    return this.prisma.technician.update({
      where: { id },
      data: updateTechnicianDto,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  // Delete technician
  async deleteTechnician(id: number) {
    const technician = await this.prisma.technician.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${id} not found`);
    }

    // Check if technician has active tasks
    const activeTasks = await this.prisma.task.count({
      where: {
        technicianId: technician.id, // Fixed: should be technician.id, not technician.userId
        complaint: {
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
        },
      },
    });

    if (activeTasks > 0) {
      throw new BadRequestException(
        'Cannot delete technician with active tasks. Reassign tasks first.'
      );
    }

    // Update user role back to RESIDENT
    await this.prisma.user.update({
      where: { id: technician.userId },
      data: { role: Role.RESIDENT },
    });

    // Delete technician record
    await this.prisma.technician.delete({
      where: { id },
    });

    return { message: 'Technician deleted successfully' };
  }

  // Get available technicians (for assignment)
  async getAvailableTechnicians() {
    return this.prisma.technician.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        tasks: {
          where: {
            complaint: {
              status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
            },
          },
        },
      },
    });
  }

  // Get technician performance stats
  async getTechnicianStats() {
    const technicians = await this.prisma.technician.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        tasks: {
          include: {
            complaint: true,
          },
        },
      },
    });

    return technicians.map(tech => {
      const completedTasks = tech.tasks.filter(task => 
        task.complaint.status === 'RESOLVED'
      );
      
      const totalResolutionTime = completedTasks.reduce((total, task) => {
        if (task.complaint.resolvedAt && task.complaint.createdAt) {
          const resolutionTime = task.complaint.resolvedAt.getTime() - task.complaint.createdAt.getTime();
          return total + resolutionTime;
        }
        return total;
      }, 0);

      const avgResolutionTime = completedTasks.length > 0 
        ? totalResolutionTime / completedTasks.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      return {
        id: tech.id,
        name: tech.user.name,
        email: tech.user.email,
        speciality: tech.speciality,
        status: tech.status,
        totalTasks: tech.tasks.length,
        completedTasks: completedTasks.length,
        efficiency: tech.tasks.length > 0 ? (completedTasks.length / tech.tasks.length) * 100 : 0,
        avgResolutionTime: Math.round(avgResolutionTime * 100) / 100, // 2 decimal places
      };
    });
  }

  // Add password reset method
  async resetTechnicianPassword(technicianId: number, newPassword: string) {
    const technician = await this.prisma.technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${technicianId} not found`);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: technician.userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password reset successfully' };
  }
}