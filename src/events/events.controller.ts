// src/events/events.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, EventType } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(Role.ADMIN)
  async createEvent(@Body() createEventDto: CreateEventDto, @Request() req) {
    return this.eventsService.createEvent({
      ...createEventDto,
      createdById: req.user.id,
    });
  }

  @Get()
  async getAllEvents(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('type') type?: EventType,
    @Query('technicianId') technicianId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.eventsService.getAllEvents(
      parseInt(page),
      parseInt(limit),
      type,
      technicianId ? parseInt(technicianId) : undefined,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('calendar')
  async getCalendarEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req,
  ) {
    return this.eventsService.getCalendarEvents(
      new Date(startDate),
      new Date(endDate),
      req.user.id,
    );
  }

  @Get('my')
  async getUserEvents(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.eventsService.getCalendarEvents(
      startDate ? new Date(startDate) : new Date(),
      endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      req.user.id,
    );
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  async getEventStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.eventsService.getEventStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('technician/:id/availability')
  @Roles(Role.ADMIN)
  async getTechnicianAvailability(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.eventsService.getTechnicianAvailability(
      parseInt(id),
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(parseInt(id));
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(parseInt(id), updateEventDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteEvent(@Param('id') id: string) {
    return this.eventsService.deleteEvent(parseInt(id));
  }
}