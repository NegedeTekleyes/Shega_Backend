// src/technicians/technicians.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TechnicianStatus, Role, Speciality, ComplaintStatus } from '@prisma/client';
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
        task.complaint.status === ComplaintStatus.RESOLVED
      );
      const activeTasks = tech.tasks.filter(task => 
        task.complaint.status === ComplaintStatus.ASSIGNED || 
        task.complaint.status === ComplaintStatus.IN_PROGRESS
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
        technicianId: technician.id,
        complaint: {
          status: { 
            in: [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS] 
          },
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
        status: TechnicianStatus.ACTIVE,
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
              status: { 
                in: [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS] 
              },
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
        task.complaint.status === ComplaintStatus.RESOLVED
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

  // Get technician by user ID
  async getTechnicianByUserId(userId: number) {
    console.log(`🔍 [Service] Looking for technician with user ID: ${userId}`);
    
    const technician = await this.prisma.technician.findFirst({
      where: { userId },
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
      },
    });

    console.log(`👨‍🔧 [Service] Technician found:`, technician);

    if (!technician) {
      console.log(`❌ [Service] No technician profile found for user ${userId}`);
      throw new NotFoundException('Technician profile not found. Please complete your technician profile.');
    }

    return technician;
  }

  // Get tasks by technician ID
  // async getTasksByTechnician(technicianId: number) {
  //   console.log(`📋 [Service] Getting tasks for technician ID: ${technicianId}`);
    
  //   const tasks = await this.prisma.task.findMany({
  //     where: { technicianId },
  //     include: {
  //       complaint: {
  //         include: {
  //           user: {
  //             select: {
  //               name: true,
  //               email: true,
  //               phone: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //     orderBy: { assignedAt: 'desc' },
  //   });

  //   console.log(`✅ [Service] Found ${tasks.length} tasks for technician ${technicianId}`);

  //   // Transform the data to match frontend expectations
  //   return tasks.map(task => ({
  //     id: task.complaintId, // Use complaintId directly
  //     taskId: task.id, // Actual task ID
  //     title: task.complaint.title,
  //     description: task.complaint.description,
  //     category: task.complaint.category,
  //     urgency: task.complaint.urgency,
  //     status: task.complaint.status,
  //     // Remove location and photos if they don't exist in your schema
  //     createdAt: task.complaint.createdAt,
  //     assignedAt: task.assignedAt,
  //     user: task.complaint.user,
  //   }));
  // }

  // Get tasks by technician ID
async getTasksByTechnician(technicianId: number) {
  console.log(`📋 [Service] Getting tasks for technician ID: ${technicianId}`);
  
  const tasks = await this.prisma.task.findMany({
    where: { technicianId },
    include: {
      complaint: {
        // Use select instead of include
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          urgency: true,
          status: true,
          location: true, // Json field
          photos: true,   // Json field
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
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
  });

  console.log(`✅ [Service] Found ${tasks.length} tasks for technician ${technicianId}`);

  // Transform the data to match frontend expectations
  return tasks.map(task => ({
    id: task.complaint.id, // Complaint ID for frontend
    taskId: task.id, // Actual task ID
    title: task.complaint.title,
    description: task.complaint.description,
    category: task.complaint.category,
    urgency: task.complaint.urgency,
    status: task.complaint.status,
    location: task.complaint.location, // Json field
    photos: task.complaint.photos,     // Json field
    createdAt: task.complaint.createdAt,
    assignedAt: task.assignedAt,
    user: task.complaint.user,
  }));
}
  // Get task detail by COMPLAINT ID (not task ID) - FIXED VERSION
  // async getTaskDetail(complaintId: number, technicianId: number) {
  //   console.log(`🔍 [Service] Looking for task with complaint ID: ${complaintId} for technician: ${technicianId}`);
    
  //   const task = await this.prisma.task.findFirst({
  //     where: { 
  //       complaintId: complaintId, // Search by complaintId instead of task id
  //       technicianId: technicianId
  //     },
  //     include: {
  //       complaint: {
  //         include: {
  //           user: {
  //             select: {
  //               id: true,
  //               name: true,
  //               email: true,
  //               phone: true,
  //             },
  //           },
  //         },
  //       },
  //       technician: {
  //         include: {
  //           user: {
  //             select: {
  //               name: true,
  //               email: true,
  //               phone: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   console.log(`📦 [Service] Task found:`, task);

  //   if (!task) {
  //     console.log(`❌ [Service] No task found for complaint ${complaintId} and technician ${technicianId}`);
      
  //     // Debug: Check if complaint exists and what technician it's assigned to
  //     const complaint = await this.prisma.complaint.findUnique({
  //       where: { id: complaintId },
  //       include: {
  //         tasks: {
  //           include: {
  //             technician: {
  //               include: {
  //                 user: true
  //               }
  //             }
  //           }
  //         }
  //       }
  //     });
      
  //     console.log(`🔎 [Service] Complaint ${complaintId} details:`, complaint);
      
  //     if (complaint && complaint.tasks.length > 0) {
  //       console.log(`👥 [Service] Complaint is assigned to technicians:`, complaint.tasks.map(t => ({
  //         taskId: t.id,
  //         technicianId: t.technicianId,
  //         technicianName: t.technician.user.name
  //       })));
  //     } else if (complaint) {
  //       console.log(`❌ [Service] Complaint ${complaintId} exists but has no tasks assigned`);
  //     } else {
  //       console.log(`❌ [Service] Complaint ${complaintId} does not exist in database`);
  //     }
      
  //     throw new NotFoundException(`Task with complaint ID ${complaintId} not found or you don't have access`);
  //   }

  //   // Transform the data according to your schema
  //   const result = {
  //     id: task.complaintId, // Use complaintId directly
  //     taskId: task.id, // Include the actual task ID
  //     title: task.complaint.title,
  //     description: task.complaint.description,
  //     category: task.complaint.category,
  //     urgency: task.complaint.urgency,
  //     status: task.complaint.status,
  //     // Remove location and photos if they don't exist in your schema
  //     createdAt: task.complaint.createdAt,
  //     assignedAt: task.assignedAt,
  //     user: task.complaint.user,
  //     technician: task.technician ? {
  //       name: task.technician.user.name,
  //       email: task.technician.user.email,
  //       phone: task.technician.user.phone,
  //     } : null,
  //   };

  //   console.log(`✅ [Service] Returning task detail:`, result);
  //   return result;
  // }

  // Get task detail by COMPLAINT ID (not task ID) - FIXED VERSION
async getTaskDetail(complaintId: number, technicianId: number) {
  console.log(`🔍 [Service] Looking for task with complaint ID: ${complaintId} for technician: ${technicianId}`);
  
  const task = await this.prisma.task.findFirst({
    where: { 
      complaintId: complaintId,
      technicianId: technicianId
    },
    include: {
      complaint: {
        // Use select instead of include for the complaint
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          urgency: true,
          status: true,
          location: true, // Json field
          photos: true,   // Json field
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      technician: {
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
  });

  console.log(`📦 [Service] Task found:`, task);

  if (!task) {
    console.log(`❌ [Service] No task found for complaint ${complaintId} and technician ${technicianId}`);
    
    // Debug: Check if complaint exists and what technician it's assigned to
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        tasks: {
          include: {
            technician: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });
    
    console.log(`🔎 [Service] Complaint ${complaintId} details:`, complaint);
    
    if (complaint && complaint.tasks.length > 0) {
      console.log(`👥 [Service] Complaint is assigned to technicians:`, complaint.tasks.map(t => ({
        taskId: t.id,
        technicianId: t.technicianId,
        technicianName: t.technician.user.name
      })));
    } else if (complaint) {
      console.log(`❌ [Service] Complaint ${complaintId} exists but has no tasks assigned`);
    } else {
      console.log(`❌ [Service] Complaint ${complaintId} does not exist in database`);
    }
    
    throw new NotFoundException(`Task with complaint ID ${complaintId} not found or you don't have access`);
  }

  // Transform the data according to your schema
  const result = {
    id: task.complaint.id, // This is the complaint ID that frontend expects
    taskId: task.id, // Include the actual task ID
    title: task.complaint.title,
    description: task.complaint.description,
    category: task.complaint.category,
    urgency: task.complaint.urgency,
    status: task.complaint.status,
    location: task.complaint.location, // Json field
    photos: task.complaint.photos,     // Json field
    createdAt: task.complaint.createdAt,
    assignedAt: task.assignedAt,
    user: task.complaint.user,
    technician: task.technician ? {
      name: task.technician.user.name,
      email: task.technician.user.email,
      phone: task.technician.user.phone,
    } : null,
  };

  console.log(` [Service] Returning task detail:`, result);
  return result;
}
  // Update task status by COMPLAINT ID - NEW METHOD
  async updateTaskStatusByComplaintId(complaintId: number, technicianId: number, body: any) {
    const { status, note } = body;
    
    console.log(`🔄 [Service] Updating status for complaint ${complaintId} by technician ${technicianId}`);
    
    // First find the task by complaintId and technicianId
    const task = await this.prisma.task.findFirst({
      where: { 
        complaintId: complaintId,
        technicianId: technicianId
      },
      include: {
        complaint: true
      }
    });

    if (!task) {
      throw new NotFoundException(`Task for complaint ${complaintId} not found or you don't have access`);
    }

    console.log(`✅ [Service] Found task ${task.id} for complaint ${complaintId}`);

    // Update both task and complaint status
    return await this.prisma.$transaction(async (tx) => {
      // Update task with additional info
      const updatedTask = await tx.task.update({
        where: { id: task.id }, // Use the actual task ID here
        data: { 
          resolutionNotes: note,
          updatedAt: new Date()
        },
      });

      // Update complaint status
      const complaintStatus = status as ComplaintStatus;
      const updateData: any = { 
        status: complaintStatus,
        updatedAt: new Date()
      };

      // Set resolvedAt if status is RESOLVED
      if (complaintStatus === ComplaintStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
      }

      const updatedComplaint = await tx.complaint.update({
        where: { id: complaintId },
        data: updateData,
      });

      console.log(`✅ [Service] Updated complaint ${complaintId} to status: ${status}`);

      return {
        task: updatedTask,
        complaint: updatedComplaint
      };
    });
  }

  // Update task status (original method - keep for backward compatibility)
  async updateTaskStatus(taskId: number, technicianId: number, body: any) {
    const { status, note } = body;
    
    console.log(`🔄 [Service] Updating status for task ID: ${taskId} by technician: ${technicianId}`);
    
    // First verify the task belongs to this technician
    const task = await this.prisma.task.findFirst({
      where: { 
        id: taskId,
        technicianId: technicianId
      },
      include: {
        complaint: true
      }
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found or you don't have access`);
    }

    console.log(` [Service] Found task ${taskId} for complaint ${task.complaintId}`);

    // Update both task and complaint status
    return await this.prisma.$transaction(async (tx) => {
      // Update task with additional info
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: { 
          resolutionNotes: note,
          updatedAt: new Date()
        },
      });

      // Update complaint status
      const complaintStatus = status as ComplaintStatus;
      const updateData: any = { 
        status: complaintStatus,
        updatedAt: new Date()
      };

      // Set resolvedAt if status is RESOLVED
      if (complaintStatus === ComplaintStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
      }

      const updatedComplaint = await tx.complaint.update({
        where: { id: task.complaintId },
        data: updateData,
      });

      console.log(` [Service] Updated complaint ${task.complaintId} to status: ${status}`);

      return {
        task: updatedTask,
        complaint: updatedComplaint
      };
    });
  }

  // Get task detail without authorization (for backward compatibility)
  // async getTaskDetailWithoutAuth(taskId: number) {
  //   const task = await this.prisma.task.findUnique({
  //     where: { id: taskId },
  //     include: {
  //       complaint: {
  //         include: {
  //           user: {
  //             select: {
  //               id: true,
  //               name: true,
  //               email: true,
  //               phone: true,
  //             },
  //           },
  //         },
  //       },
  //       technician: {
  //         include: {
  //           user: {
  //             select: {
  //               name: true,
  //               email: true,
  //               phone: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   if (!task) {
  //     throw new NotFoundException(`Task with ID ${taskId} not found`);
  //   }

  //   // Transform the data according to your schema
  //   return {
  //     id: task.complaintId,
  //     title: task.complaint.title,
  //     description: task.complaint.description,
  //     category: task.complaint.category,
  //     urgency: task.complaint.urgency,
  //     status: task.complaint.status,
  //     createdAt: task.complaint.createdAt,
  //     assignedAt: task.assignedAt,
  //     user: task.complaint.user,
  //     technician: task.technician ? {
  //       name: task.technician.user.name,
  //       email: task.technician.user.email,
  //       phone: task.technician.user.phone,
  //     } : null,
  //   };
  // }

  // Get task detail without authorization (for backward compatibility)
async getTaskDetailWithoutAuth(taskId: number) {
  const task = await this.prisma.task.findUnique({
    where: { id: taskId },
    include: {
      complaint: {
        // Use select instead of include
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          urgency: true,
          status: true,
          location: true, // Json field
          photos: true,   // Json field
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      technician: {
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
  });

  if (!task) {
    throw new NotFoundException(`Task with ID ${taskId} not found`);
  }

  // Transform the data according to your schema
  return {
    id: task.complaint.id,
    title: task.complaint.title,
    description: task.complaint.description,
    category: task.complaint.category,
    urgency: task.complaint.urgency,
    status: task.complaint.status,
    location: task.complaint.location, // Json field
    photos: task.complaint.photos,     // Json field
    createdAt: task.complaint.createdAt,
    assignedAt: task.assignedAt,
    user: task.complaint.user,
    technician: task.technician ? {
      name: task.technician.user.name,
      email: task.technician.user.email,
      phone: task.technician.user.phone,
    } : null,
  };
}

  // Get technician's assigned complaints (alternative method)
  // async getAssignedComplaints(technicianId: number) {
  //   const tasks = await this.prisma.task.findMany({
  //     where: { technicianId },
  //     include: {
  //       complaint: {
  //         include: {
  //           user: {
  //             select: {
  //               name: true,
  //               email: true,
  //               phone: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //     orderBy: { assignedAt: 'desc' },
  //   });

  //   return tasks.map(task => ({
  //     id: task.complaintId,
  //     title: task.complaint.title,
  //     description: task.complaint.description,
  //     status: task.complaint.status,
  //     urgency: task.complaint.urgency,
  //     category: task.complaint.category,
  //     createdAt: task.complaint.createdAt,
  //     assignedAt: task.assignedAt,
  //     user: task.complaint.user,
  //   }));
  // }
  // Get technician's assigned complaints (alternative method)
async getAssignedComplaints(technicianId: number) {
  const tasks = await this.prisma.task.findMany({
    where: { technicianId },
    include: {
      complaint: {
        // Use select instead of include
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          urgency: true,
          status: true,
          location: true, // Json field
          photos: true,   // Json field
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
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
  });

  return tasks.map(task => ({
    id: task.complaint.id,
    title: task.complaint.title,
    description: task.complaint.description,
    status: task.complaint.status,
    urgency: task.complaint.urgency,
    category: task.complaint.category,
    location: task.complaint.location, // Json field
    photos: task.complaint.photos,     // Json field
    createdAt: task.complaint.createdAt,
    assignedAt: task.assignedAt,
    user: task.complaint.user,
  }));
}
}