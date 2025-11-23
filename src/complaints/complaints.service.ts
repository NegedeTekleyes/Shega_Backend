// src/complaints/complaints.service.ts
import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintStatus, Priority, ComplaintCategory, Prisma } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);
  private cloudinaryConfigured = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.configureCloudinary();
  }

  private configureCloudinary() {
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.cloudinaryConfigured = true;
      this.logger.log('Cloudinary configured successfully');
    } else {
      this.logger.warn('Cloudinary not configured. Photo uploads will be skipped.');
    }
  }

  private async uploadPhoto(photoUri: string): Promise<string | null> {
    if (!this.cloudinaryConfigured) return null;

    try {
      const base64Data = photoUri.replace(/^data:image\/\w+;base64,/, '');
      // const result = await cloudinary.uploader.upload(
      //   `data:image/jpeg;base64,${base64Data}`,
      //   { folder: 'shega-report' }
      // );

      return base64Data;
      // return result.secure_url;
    } catch (error: any) {
      this.logger.error(`Cloudinary upload failed: ${error.message}`);
      return null;
    }
  }

  // CREATE - Submit complaint
  async create(userId: number, dto: CreateComplaintDto) {
    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Validate required fields
      if (!dto.title?.trim()) {
        throw new BadRequestException('Title is required');
      }
      if (!dto.description?.trim()) {
        throw new BadRequestException('Description is required');
      }
      if (!dto.category) {
        throw new BadRequestException('Category is required');
      }

      // Validate category is a valid enum value
      const validCategories = Object.values(ComplaintCategory);
      if (!validCategories.includes(dto.category as ComplaintCategory)) {
        throw new BadRequestException(
          `Invalid category: ${dto.category}. Valid categories: ${validCategories.join(', ')}`
        );
      }

      const photos: string[] = [];
      // Upload photos if provided
      if (dto.photos?.length) {
        console.log("number of photor",dto.photos.length)
        this.logger.log(`Uploading ${dto.photos.length} photos for user ${userId}`);
        for (let i = 0; i < dto.photos.length; i++) {
          const url = await this.uploadPhoto(dto.photos[i]);
          if (url) photos.push(url);
        }
        this.logger.log(`Successfully uploaded ${photos.length} photos`);
      }

      // FIXED: Location data handling
      let locationData: Prisma.InputJsonValue | undefined;

      if (dto.locationData) {
        locationData = {
          latitude: dto.locationData.latitude,
          longitude: dto.locationData.longitude,
          address: dto.locationData.address || null,
          accuracy: dto.locationData.accuracy || null,
        } as Prisma.InputJsonValue;
      }

      // Map urgency with validation
      const urgencyMap: { [key: string]: Priority } = {
        'low': Priority.LOW,
        'medium': Priority.MEDIUM,
        'high': Priority.HIGH,
        'emergency': Priority.EMERGENCY,
      };

      const urgency = urgencyMap[dto.urgency] || Priority.MEDIUM;

      // Create the complaint
      const complaint = await this.prisma.complaint.create({
        data: {
          userId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category as ComplaintCategory,
          urgency: urgency,
          location: locationData,
          photos:photos,
          status: ComplaintStatus.SUBMITTED,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          tasks: {
            include: {
              technician: { 
                include: { 
                  user: { 
                    select: { id: true, name: true, email: true } 
                  } 
                } 
              },
            },
          },
        },
      });

      this.logger.log(`Complaint created successfully: ID ${complaint.id} for user ${userId}`);
      return complaint;

    } catch (error) {
      this.logger.error(`Error creating complaint for user ${userId}: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create complaint');
    }
  }

  // READ - All complaints with pagination (Admin only)
  async getAllComplaints(
        page = 1, 
        limit = 10,
        status?: ComplaintStatus,
        urgency?: string,
        category?: string, 
      ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if(status) where.status = status
    if(urgency) where.urgency = urgency
    if(category) where.category = category

    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true} },
          tasks: {
            include: {
              technician: { 
                include: { 
                  user: { select: { id: true, name: true, email: true } } 
                } 
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { 
      complaints, 
      pagination: { 
        page, 
        limit, 
        total, 
        pages: Math.ceil(total / limit) 
      } 
    };
  }

  // READ - Get single complaint by ID
  async getComplaintById(id: number) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true} },
        tasks: {
          include: {
            technician: { 
              include: { 
                user: { select: { id: true, name: true, email: true} } 
              } 
            },
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }
    return complaint;
  }

  // UPDATE - Complaint status
  async updateComplaintStatus(id: number, status: ComplaintStatus, adminNotes?: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    const data: any = { 
      status,
      updatedAt: new Date()
    };
    
    if (status === ComplaintStatus.RESOLVED) {
      data.resolvedAt = new Date();
    }
    
    if (adminNotes) {
      data.adminNotes = adminNotes;
    }

    return this.prisma.complaint.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        tasks: {
          include: {
            technician: { 
              include: { 
                user: { select: { id: true, name: true, email: true } } 
              } 
            },
          },
        },
      },
    });
  }

  // UPDATE - Assign technician to complaint
  async assignTechnician(complaintId: number, technicianId: number) {
    // Verify complaint exists
    const complaint = await this.prisma.complaint.findUnique({ 
      where: { id: complaintId } 
    });
    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${complaintId} not found`);
    }

    // Verify technician exists and is active
    const technician = await this.prisma.technician.findUnique({
      where: { id: technicianId }, 
      include: { user: true },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${technicianId} not found`);
    }

    if (technician.status !== 'ACTIVE') {
      throw new BadRequestException(`Technician with ID ${technicianId} is not active`);
    }

    // Update complaint status to ASSIGNED
    await this.prisma.complaint.update({
      where: { id: complaintId },
      data: { 
        status: ComplaintStatus.ASSIGNED,
        assignedAt: new Date() 
      },
    });

    // Find existing task for this complaint
    const existingTask = await this.prisma.task.findFirst({ 
      where: { complaintId } 
    });

    if (existingTask) {
      // Update existing task
      return this.prisma.task.update({
        where: { id: existingTask.id },
        data: { 
          technicianId, 
          assignedAt: new Date(),
          updatedAt: new Date() 
        },
        include: {
          technician: { 
            include: { 
              user: { select: { id: true, name: true, email: true } } 
            } 
          },
          complaint: { 
            include: { 
              user: { select: { id: true, name: true, email: true } } 
            } 
          },
        },
      });
    } else {
      // Create new task
      return this.prisma.task.create({
        data: { 
          complaintId, 
          technicianId, 
          assignedAt: new Date() 
        },
        include: {
          technician: { 
            include: { 
              user: { select: { id: true, name: true, email: true } } 
            } 
          },
          complaint: { 
            include: { 
              user: { select: { id: true, name: true, email: true } } 
            } 
          },
        },
      });
    }
  }

  // DELETE - Complaint (Admin only)
  async deleteComplaint(id: number) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    // Delete related tasks first (due to foreign key constraints)
    await this.prisma.task.deleteMany({ where: { complaintId: id } });
    
    // Delete the complaint
    return this.prisma.complaint.delete({ where: { id } });
  }

  // GET - Complaint stats (Admin only)
  async getComplaintStats() {
    const statuses: ComplaintStatus[] = [
      ComplaintStatus.SUBMITTED, 
      ComplaintStatus.ASSIGNED, 
      ComplaintStatus.IN_PROGRESS, 
      ComplaintStatus.RESOLVED, 
      ComplaintStatus.REJECTED
    ];
    
    const counts = await Promise.all(
      statuses.map(status => 
        this.prisma.complaint.count({ where: { status } })
      )
    );
    
    const total = counts.reduce((sum, count) => sum + count, 0);

    return {
      total,
      byStatus: statuses.reduce((obj, status, index) => ({
        ...obj, 
        [status.toLowerCase()]: counts[index] 
      }), {}),
      recentCount: await this.prisma.complaint.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    };
  }

  // Get complaints for a specific user with pagination
  async findAllByUser(userId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
 
    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where: { userId },
        include: {
          user: { select: { id: true, name: true, email: true} },
          tasks: {
            include: { 
              technician: { 
                include: { 
                  user: { select: { id: true, name: true, email: true } } 
                } 
              } 
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.complaint.count({ where: { userId } }),
    ]);

    return {
      complaints,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Get single complaint for a specific user (ownership verification)
  async findOneByUser(id: number, userId: number) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id, userId },
      include: {
        user: { select: { id: true, name: true, email: true} },
        tasks: { 
          include: { 
            technician: { 
              include: { 
                user: { select: { id: true, name: true, email: true} } 
              } 
            } 
          } 
        },
      },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }
    return complaint;
  }

  // Get assigned complaints for a technician
  async findAssignedComplaints(technicianUserId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where: {
          tasks: {
            some: {
              technician: {
                userId: technicianUserId,
              },
            },
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true} },
          tasks: {
            where: {
              technician: {
                userId: technicianUserId,
              },
            },
            include: {
              technician: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.complaint.count({
        where: {
          tasks: {
            some: {
              technician: {
                userId: technicianUserId,
              },
            },
          },
        },
      }),
    ]);

    return {
      complaints,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}