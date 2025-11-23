import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventType } from "@prisma/client";


@Injectable()
export class EventsService {
    constructor (private prisma: PrismaService){}

    // create bnew event
    async createEvent(createEventDto: CreateEventDto & {createdById: number}) {
        const {title, description, start, end, type, technicianId, participantIds, recurrenceRule, createdById} = createEventDto

        // validate dates
        if(start >= end) {
            throw new BadRequestException('End date must be after start date');

        }
        // validate technician exits if provided
        if(technicianId) {
            const technician = await this.prisma.technician.findUnique({
                where: {id: technicianId},
                include: {user:  true},
            })
             if (!technician) {
        throw new NotFoundException(`Technician with ID ${technicianId} not found`);
      }
        }
          try {
      const event = await this.prisma.event.create({
        data: {
          title,
          description,
          start,
          end,
          type,
          recurrenceRule,
          createdById,
          technicianId,
          participants: participantIds && participantIds.length > 0 ? {
            connect: participantIds.map(id => ({ id })),
          } : undefined,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
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
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return event;
    } catch (error) {
      throw new BadRequestException('Failed to create event');
    }
  
    }
     // Get all events with filtering
  async getAllEvents(
    page: number = 1,
    limit: number = 10,
    type?: EventType,
    technicianId?: number,
    startDate?: Date,
    endDate?: Date,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (technicianId) {
      where.technicianId = technicianId;
    }

    if (startDate && endDate) {
      where.OR = [
        { start: { gte: startDate, lte: endDate } },
        { end: { gte: startDate, lte: endDate } },
        { start: { lte: startDate }, end: { gte: endDate } },
      ];
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
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
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { start: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Get events for calendar view (date range)
  async getCalendarEvents(startDate: Date, endDate: Date, userId?: number) {
    const where: any = {
      OR: [
        { start: { gte: startDate, lte: endDate } },
        { end: { gte: startDate, lte: endDate } },
        { start: { lte: startDate }, end: { gte: endDate } },
      ],
    };

    // If user ID provided, only show their events
    if (userId) {
      where.OR = [
        { createdById: userId },
        { participants: { some: { id: userId } } },
        ...where.OR,
      ];
    }

    return this.prisma.event.findMany({
      where,
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
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
        participants: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { start: 'asc' },
    });
  }

  // Get event by ID
  async getEventById(id: number) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
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
        participants: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  // Update event
  async updateEvent(id: number, updateEventDto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    // Validate dates if both are provided
    if (updateEventDto.start && updateEventDto.end && updateEventDto.start >= updateEventDto.end) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate technician exists if provided
    if (updateEventDto.technicianId) {
      const technician = await this.prisma.technician.findUnique({
        where: { id: updateEventDto.technicianId },
      });
      if (!technician) {
        throw new NotFoundException(`Technician with ID ${updateEventDto.technicianId} not found`);
      }
    }

    try {
      const updatedEvent = await this.prisma.event.update({
        where: { id },
        data: {
          ...updateEventDto,
          participants: updateEventDto.participantIds ? {
            set: updateEventDto.participantIds.map(id => ({ id })),
          } : undefined,
        },
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
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
          participants: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return updatedEvent;
    } catch (error) {
      throw new BadRequestException('Failed to update event');
    }
  }

  // Delete event
  async deleteEvent(id: number) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return this.prisma.event.delete({
      where: { id },
    });
  }

  // Get events statistics
  async getEventStats(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate && endDate) {
      where.start = { gte: startDate, lte: endDate };
    }

    const [
      totalEvents,
      byType,
      byStatus,
      upcomingEvents,
    ] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.groupBy({
        by: ['type'],
        _count: { id: true },
        where,
      }),
      this.prisma.event.groupBy({
        by: ['status'],
        _count: { id: true },
        where,
      }),
      this.prisma.event.count({
        where: {
          start: { gte: new Date() },
          status: 'SCHEDULED',
        },
      }),
    ]);

    return {
      totalEvents,
      byType,
      byStatus,
      upcomingEvents,
    };
  }

  // Get technician availability
  async getTechnicianAvailability(technicianId: number, startDate: Date, endDate: Date) {
    const technician = await this.prisma.technician.findUnique({
      where: { id: technicianId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID ${technicianId} not found`);
    }

    // Get technician's events in the date range
    const events = await this.prisma.event.findMany({
      where: {
        technicianId,
        OR: [
          { start: { gte: startDate, lte: endDate } },
          { end: { gte: startDate, lte: endDate } },
        ],
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        type: true,
        status: true,
      },
      orderBy: { start: 'asc' },
    });

    return {
      technician: {
        id: technician.id,
        name: technician.user.name,
        status: technician.status,
      },
      events,
      availability: this.calculateAvailability(events, startDate, endDate),
    };
  }

  private calculateAvailability(events: any[], startDate: Date, endDate: Date) {
    const busySlots = events.map(event => ({
      start: event.start,
      end: event.end,
      title: event.title,
    }));

    return {
      busySlots,
      available: busySlots.length === 0,
    };
  }
}