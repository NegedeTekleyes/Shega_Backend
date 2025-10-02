// src/reports/reports.service.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, Role } from '@prisma/client';

interface CreateReportDto {
  title: string;
  type: ReportType;
  filters: any;
  generatedBy: number;
}
interface FormattedTechnicianData {
  id: number;
  name: string | null;
  email: string;
  speciality?: string | null;
  totalTasks: number;
  completedTasks: number;
  efficiency: number;
}
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Generate comprehensive analytics report
  async generateAnalyticsReport(startDate: Date, endDate: Date, generatedBy: number) {
    try {
      // Get complaints statistics
      const complaintsStats = await this.prisma.complaint.groupBy({
        by: ['status', 'category'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          id: true,
        },
      });

      // Calculate average resolution time manually
      const resolvedComplaints = await this.prisma.complaint.findMany({
        where: {
          status: 'RESOLVED',
          resolvedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          createdAt: true,
          resolvedAt: true,
        },
      });

      const totalResolutionTime = resolvedComplaints.reduce((total, complaint) => {
        if (complaint.resolvedAt && complaint.createdAt) {
          return total + (complaint.resolvedAt.getTime() - complaint.createdAt.getTime());
        }
        return total;
      }, 0);

      const averageResolutionTime = resolvedComplaints.length > 0 
        ? totalResolutionTime / resolvedComplaints.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      // Get technician performance
      const technicianPerformance = await this.prisma.user.findMany({
        where: {
          role: 'TECHNICIAN',
          tasks: {
            some: {
              complaint: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
        include: {
          tasks: {
            include: {
              complaint: true,
            },
          },
          technician: true,
        },
      });

      const formattedTechnicianData: FormattedTechnicianData[] = technicianPerformance.map(tech => {
        const completedTasks = tech.tasks.filter(task => 
          task.complaint.status === 'RESOLVED'
        );
        const totalTasks = tech.tasks.length;
        const efficiency = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

        return {
          id: tech.id,
          name: tech.name,
          email: tech.email,
          speciality: tech.technician?.speciality,
          totalTasks,
          completedTasks: completedTasks.length,
          efficiency: Math.round(efficiency),
        };
      });

      // Get category-wise analysis
      const categoryAnalysis = await this.prisma.complaint.groupBy({
        by: ['category'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          id: true,
        },
      });

      // Get trend data (monthly)
      const monthlyTrends = await this.getMonthlyTrends(startDate, endDate);

      return {
        period: {
          start: startDate,
          end: endDate,
        },
        summary: {
          totalComplaints: complaintsStats.reduce((sum, item) => sum + item._count.id, 0),
          resolvedComplaints: complaintsStats
            .filter(item => item.status === 'RESOLVED')
            .reduce((sum, item) => sum + item._count.id, 0),
          activeTechnicians: technicianPerformance.length,
          averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
        },
        complaintsByStatus: this.formatGroupedData(complaintsStats, 'status'),
        complaintsByCategory: this.formatGroupedData(complaintsStats, 'category'),
        technicianPerformance: formattedTechnicianData,
        categoryAnalysis,
        monthlyTrends,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error generating analytics report:', error);
      throw new InternalServerErrorException('Failed to generate analytics report');
    }
  }

  // Generate technician performance report
  async generateTechnicianReport(technicianId: number, startDate: Date, endDate: Date, generatedBy: number) {
    const technician = await this.prisma.user.findUnique({
      where: {
        id: technicianId,
        role: 'TECHNICIAN',
      },
      include: {
        technician: true,
        tasks: {
          where: {
            assignedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            complaint: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    const completedTasks = technician.tasks.filter(task => 
      task.complaint.status === 'RESOLVED'
    );
    const inProgressTasks = technician.tasks.filter(task => 
      task.complaint.status === 'IN_PROGRESS'
    );

    // Calculate various metrics
    const totalTasks = technician.tasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

    // Calculate average resolution time
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

    // Category distribution
    const categoryDistribution = await this.prisma.complaint.groupBy({
      by: ['category'],
      where: {
        task: {
          is: {
            technicianId: technicianId,
          },
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Monthly performance
    const monthlyPerformance = await this.getTechnicianMonthlyPerformance(technicianId, startDate, endDate);

    return {
      technician: {
        id: technician.id,
        name: technician.name,
        email: technician.email,
        speciality: technician.technician?.speciality,
        status: technician.technician?.status,
      },
      period: {
        start: startDate,
        end: endDate,
      },
      performance: {
        totalTasks,
        completedTasks: completedTasks.length,
        inProgressTasks: inProgressTasks.length,
        completionRate: Math.round(completionRate),
        averageResolutionTime: Math.round(avgResolutionTime * 100) / 100,
        efficiency: Math.round(completionRate), // Could be different calculation
      },
      categoryDistribution,
      monthlyPerformance,
      recentTasks: completedTasks.slice(0, 10).map(task => ({
        id: task.complaint.id,
        title: task.complaint.title,
        category: task.complaint.category,
        assignedAt: task.assignedAt,
        resolvedAt: task.complaint.resolvedAt,
        user: task.complaint.user.name,
      })),
      generatedAt: new Date(),
    };
  }

  // Generate financial report (if you have payment data)
  async generateFinancialReport(startDate: Date, endDate: Date, generatedBy: number) {
    // This would depend on your business model
    // Placeholder for financial metrics
    return {
      period: { start: startDate, end: endDate },
      revenue: {
        total: 0,
        byService: [],
      },
      expenses: {
        total: 0,
        categories: [],
      },
      profitability: {
        netProfit: 0,
        margin: 0,
      },
      generatedAt: new Date(),
    };
  }

  // Save report to database
  async saveReport(createReportDto: CreateReportDto, reportData: any) {
    return this.prisma.report.create({
      data: {
        title: createReportDto.title,
        type: createReportDto.type,
        filters: createReportDto.filters,
        data: reportData,
        generatedBy: createReportDto.generatedBy,
      },
    });
  }

  // Get all saved reports
  async getSavedReports(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        include: {
          generatedByUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { generatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.report.count(),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Get report by ID
  async getReportById(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        generatedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  // Delete report
  async deleteReport(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.report.delete({
      where: { id },
    });
  }

  // Private helper methods
  private async getMonthlyTrends(startDate: Date, endDate: Date) {
    const trends = await this.prisma.complaint.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Group by month and format
    const monthlyData = trends.reduce((acc, item) => {
      const month = item.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month] += item._count.id;
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, count]) => ({
      month,
      complaints: count,
    }));
  }

  private async getTechnicianMonthlyPerformance(technicianId: number, startDate: Date, endDate: Date) {
    const tasks = await this.prisma.tasks.findMany({
      where: {
        technicianId,
        assignedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        complaint: true,
      },
    });

    const monthlyData = tasks.reduce((acc, task) => {
      const month = task.assignedAt.toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = { assigned: 0, completed: 0 };
      }
      acc[month].assigned++;
      if (task.complaint.status === 'RESOLVED') {
        acc[month].completed++;
      }
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, data]: [string, any]) => ({
      month,
      assigned: data.assigned,
      completed: data.completed,
      completionRate: Math.round((data.completed / data.assigned) * 100),
    }));
  }

  private formatGroupedData(data: any[], groupBy: string) {
    return data.reduce((acc, item) => {
      const key = item[groupBy];
      if (!acc[key]) {
        acc[key] = 0;
      }
      acc[key] += item._count.id;
      return acc;
    }, {});
  }
}