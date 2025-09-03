// src/complaints/complaints.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CompliantsService {
  private readonly logger = new Logger(CompliantsService.name);
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
      latitude: dto.locationData.latitude,
      longitude: dto.locationData.longitude,
      address: dto.locationData.address,
      accuracy: dto.locationData.accuracy,
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
}