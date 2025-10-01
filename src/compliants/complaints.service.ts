// src/complaints/complaints.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintStatus, Priority } from '@prisma/client';
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

    this.logger.log(`Cloudinary config - Cloud: ${cloudName}, Key: ${apiKey ? 'SET' : 'MISSING'}, Secret: ${apiSecret ? 'SET' : 'MISSING'}`);

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

  // Helper to upload base64 image to Cloudinary
  private async uploadPhoto(photoUri: string): Promise<string | null> {
    if (!this.cloudinaryConfigured) {
      this.logger.warn('Cloudinary not configured, skipping photo upload');
      return null;
    }

    try {
      this.logger.log('Attempting to upload photo to Cloudinary');
      
      // Remove the data:image/...;base64, prefix if present
      const base64Data = photoUri.replace(/^data:image\/\w+;base64,/, '');
      
      const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${base64Data}`, {
        folder: 'shega-report',
      });

      this.logger.log(`Photo uploaded successfully: ${result.secure_url}`);
      return result.secure_url;
    } catch (error: any) {
      this.logger.error(`Failed to upload photo: ${error.message}`, error.stack);
      return null;
    }
  }

  // CREATE - For residents to submit complaints
  async create(userId: number, dto: CreateComplaintDto) {
    this.logger.log(`Creating complaint for user ${userId}`);
    this.logger.log(`Received ${dto.photos?.length || 0} photos`);

    let uploadPhotos: string[] = [];

    if (dto.photos && dto.photos.length > 0) {
      this.logger.log(`Processing ${dto.photos.length} photos`);
      
      // Upload photos sequentially for better debugging
      for (let i = 0; i < dto.photos.length; i++) {
        const photo = dto.photos[i];
        this.logger.log(`Uploading photo ${i + 1}/${dto.photos.length}`);
        
        const uploadedUrl = await this.uploadPhoto(photo);
        if (uploadedUrl) {
          uploadPhotos.push(uploadedUrl);
          this.logger.log(`Photo ${i + 1} uploaded successfully`);
        } else {
          this.logger.warn(`Photo ${i + 1} failed to upload`);
        }
      }

      this.logger.log(`Uploaded ${uploadPhotos.length}/${dto.photos.length} photos`);
    }

    // Store location as JSON object
    const locationJson = {
      latitude: dto.locationData?.latitude,
      longitude: dto.locationData?.longitude,
      address: dto.locationData?.address,
      accuracy: dto.locationData?.accuracy,
    };

    try {
      this.logger.log('Creating complaint in database...');
      
      const complaint = await this.prisma.complaint.create({
        data: {
          userId: userId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          urgency: dto.urgency,
          location: locationJson,
          photos: uploadPhotos,
          timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
        },
      });

      this.logger.log(`Complaint created successfully with ID: ${complaint.id}`);
      return complaint;

    } catch (error) {
      this.logger.error('Database error creating complaint:', error);
      throw error;
    }
  }

  // READ - Get all complaints for admin dashboard
  async getAllComplaints(page: number = 1, limit: number = 10, status?: string) {
    const skip = (page - 1) * limit;
    
    const where = status ? { status: status as ComplaintStatus } : {};
    
    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          task: {
            include: {
              technician: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
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
        pages: Math.ceil(total / limit),
      },
    };
  }

  // READ - Get complaint by ID
  async getComplaintById(id: number) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        task: {
          include: {
            technician: {
              select: {
                id: true,
                name: true,
                email: true,
              },
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

  // UPDATE - Update complaint status
  async updateComplaintStatus(id: number, status: ComplaintStatus, adminNotes?: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    const updateData: any = { status };
    
    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
    }
    
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    return this.prisma.complaint.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        task: {
          include: {
            technician: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  // UPDATE - Assign technician to complaint
  async assignTechnician(complaintId: number, technicianId: number) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${complaintId} not found`);
    }

    const technician = await this.prisma.user.findFirst({
      where: {
        id: technicianId,
        role: 'TECHNICIAN',
        technician: {
          status: 'ACTIVE',
        },
      },
    });

    if (!technician) {
      throw new NotFoundException(`Active technician with ID ${technicianId} not found`);
    }

    // Create or update task
    return this.prisma.task.upsert({
      where: { complaintId },
      update: {
        technicianId,
        assignedAt: new Date(),
      },
      create: {
        complaintId,
        technicianId,
        assignedAt: new Date(),
      },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        complaint: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  // DELETE - Delete complaint
  async deleteComplaint(id: number) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    // Delete related task first (if exists)
    await this.prisma.task.deleteMany({
      where: { complaintId: id },
    });

    // Then delete complaint
    return this.prisma.complaint.delete({
      where: { id },
    });
  }

  // Get complaint statistics
  async getComplaintStats() {
    const [
      total,
      submitted,
      assigned,
      inProgress,
      resolved,
      rejected,
    ] = await Promise.all([
      this.prisma.complaint.count(),
      this.prisma.complaint.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.complaint.count({ where: { status: 'ASSIGNED' } }),
      this.prisma.complaint.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.complaint.count({ where: { status: 'RESOLVED' } }),
      this.prisma.complaint.count({ where: { status: 'REJECTED' } }),
    ]);

    return {
      total,
      byStatus: {
        submitted,
        assigned,
        inProgress,
        resolved,
        rejected,
      },
    };
  }

  // Get complaints by user (for residents)
  async findAllByUser(userId: number) {
    return this.prisma.complaint.findMany({
      where: { userId },
      include: {
        task: {
          include: {
            technician: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get single complaint by user (for residents)
  async findOneByUser(id: number, userId: number) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id, userId },
      include: {
        task: {
          include: {
            technician: {
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

    if (!complaint) {
      throw new NotFoundException(`Complaint with ID ${id} not found`);
    }

    return complaint;
  }
}