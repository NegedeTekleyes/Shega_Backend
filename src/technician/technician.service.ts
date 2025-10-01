// src/technicians/technicians.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TechnicianStatus, Role } from '@prisma/client';

interface CreateTechnicianDto {
  userId: number;
  speciality: string;
  status?: TechnicianStatus;
}

interface UpdateTechnicianDto {
  speciality?: string;
  status?: TechnicianStatus;
}

@Injectable()
export class TechniciansService {
  constructor(private prisma: PrismaService) {}

  // Get all technicians with stats
  async getAllTechnicians(page: number = 1, limit: number = 10, status?: string) {
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

  // Create new technician
  async createTechnician(createTechnicianDto: CreateTechnicianDto) {
    const {userId, speciality, status} = createTechnicianDto;
    // Verify user exists and is not already a technician
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { technician: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.technician) {
      throw new BadRequestException('User is already a technician');
    }

    // Update user role to TECHNICIAN
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.TECHNICIAN },
    });

    // Create technician record
    return this.prisma.technician.create({
      data: {
        userId: userId,
        speciality: speciality,
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
        technicianId: technician.userId,
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
        user: {
          role: 'TECHNICIAN',
        },
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
}