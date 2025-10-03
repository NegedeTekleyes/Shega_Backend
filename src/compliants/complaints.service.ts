// src/complaints/complaints.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintStatus, Priority, ComplaintCategory } from '@prisma/client';
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
      const result = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${base64Data}`,
        { folder: 'shega-report' }
      );
      return result.secure_url;
    } catch (error: any) {
      this.logger.error(`Cloudinary upload failed: ${error.message}`);
      return null;
    }
  }

  // CREATE - Submit complaint
  async create(userId: number, dto: CreateComplaintDto) {
    const photos: string[] = [];

    if (dto.photos?.length) {
      for (let i = 0; i < dto.photos.length; i++) {
        const url = await this.uploadPhoto(dto.photos[i]);
        if (url) photos.push(url);
      }
    }

    const locationJson = {
      latitude: dto.locationData?.latitude,
      longitude: dto.locationData?.longitude,
      address: dto.locationData?.address,
      accuracy: dto.locationData?.accuracy,
    };

    return this.prisma.complaint.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        category: dto.category as ComplaintCategory,
        urgency: dto.urgency as Priority,
        location: locationJson,
        photos,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        tasks: {
          include: {
            technician: { select: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });
  }

  // READ - All complaints with pagination
  async getAllComplaints(page = 1, limit = 10, status?: ComplaintStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          tasks: {
            include: {
              technician: { select: { user: { select: { id: true, name: true, email: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { complaints, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  // READ - Get single complaint by ID
  async getComplaintById(id: number) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        tasks: {
          include: {
            technician: { select: { user: { select: { id: true, name: true, email: true, phone: true } } } },
          },
        },
      },
    });

    if (!complaint) throw new NotFoundException(`Complaint with ID ${id} not found`);
    return complaint;
  }

  // UPDATE - Complaint status
  async updateComplaintStatus(id: number, status: ComplaintStatus, adminNotes?: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException(`Complaint with ID ${id} not found`);

    const data: any = { status };
    if (status === 'RESOLVED') data.resolvedAt = new Date();
    if (adminNotes) data.adminNotes = adminNotes;

    return this.prisma.complaint.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        tasks: {
          include: {
            technician: { select: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });
  }

  // UPDATE - Assign technician to complaint
  async assignTechnician(complaintId: number, technicianId: number) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) throw new NotFoundException(`Complaint with ID ${complaintId} not found`);

    const technician = await this.prisma.technician.findUnique({
      where: { userId: technicianId },
      include: { user: true },
    });

    if (!technician || technician.status !== 'ACTIVE')
      throw new NotFoundException(`Active technician with ID ${technicianId} not found`);

    // Find existing task for this complaint
    const existingTask = await this.prisma.task.findFirst({ where: { complaintId } });

    if (existingTask) {
      return this.prisma.task.update({
        where: { id: existingTask.id },
        data: { technicianId, assignedAt: new Date() },
        include: {
          technician: { select: { user: { select: { id: true, name: true, email: true } } } },
          complaint: { include: { user: true } },
        },
      });
    } else {
      return this.prisma.task.create({
        data: { complaintId, technicianId, assignedAt: new Date() },
        include: {
          technician: { select: { user: { select: { id: true, name: true, email: true } } } },
          complaint: { include: { user: true } },
        },
      });
    }
  }

  // DELETE - Complaint
  async deleteComplaint(id: number) {
    await this.prisma.task.deleteMany({ where: { complaintId: id } });
    return this.prisma.complaint.delete({ where: { id } });
  }

  // GET - Complaint stats
  async getComplaintStats() {
    const statuses: ComplaintStatus[] = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
    const counts = await Promise.all(statuses.map(s => this.prisma.complaint.count({ where: { status: s } })));
    const total = counts.reduce((sum, c) => sum + c, 0);

    return {
      total,
      byStatus: statuses.reduce((obj, status, i) => ({ ...obj, [status.toLowerCase()]: counts[i] }), {}),
    };
  }

  // Get complaints for a specific user
  async findAllByUser(userId: number) {
    return this.prisma.complaint.findMany({
      where: { userId },
      include: {
        tasks: {
          include: { technician: { select: { user: { select: { id: true, name: true, email: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByUser(id: number, userId: number) {
    const complaint = await this.prisma.complaint.findFirst({
      where: { id, userId },
      include: {
        tasks: { include: { technician: { select: { user: { select: { id: true, name: true, email: true, phone: true } } } } } },
      },
    });

    if (!complaint) throw new NotFoundException(`Complaint with ID ${id} not found`);
    return complaint;
  }
}
