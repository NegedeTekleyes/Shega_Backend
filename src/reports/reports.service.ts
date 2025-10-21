// src/reports/reports.service.ts
import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportType, Role, TechnicianStatus, ComplaintStatus, ComplaintCategory } from '@prisma/client';

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
  status: TechnicianStatus | null;
  totalTasks: number;
  completedTasks: number;
  efficiency: number;
}

interface FinancialReportData {
  period: { start: Date; end: Date };
  revenue: {
    total: number;
    byService: Array<{ category: ComplaintCategory; amount: number }>;
  };
  expenses: {
    total: number;
    categories: Array<{ name: string; amount: number }>;
  };
  profitability: {
    netProfit: number;
    margin: number;
  };
  generatedAt: Date;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Generate comprehensive analytics report
  async generateAnalyticsReport(startDate: Date, endDate: Date, generatedBy: number) {
    try {
      // Validate date range
      this.validateDateRange(startDate, endDate);

      // Get complaints statistics grouped by status & category
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

      // Calculate average resolution time
      const resolutionMetrics = await this.calculateResolutionMetrics(startDate, endDate);

      // Get technician performance - FIXED: Query through Technician model instead of User
      const technicianPerformance = await this.getTechnicianPerformance(startDate, endDate);

      // Category-wise analysis
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

      // Urgency distribution
      const urgencyDistribution = await this.prisma.complaint.groupBy({
        by: ['urgency'],
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

      return {
        period: {
          start: startDate,
          end: endDate,
        },
        summary: {
          totalComplaints: complaintsStats.reduce((sum, item) => sum + item._count.id, 0),
          resolvedComplaints: complaintsStats
            .filter(item => item.status === ComplaintStatus.RESOLVED)
            .reduce((sum, item) => sum + item._count.id, 0),
          activeTechnicians: technicianPerformance.length,
          averageResolutionTime: resolutionMetrics.averageResolutionTime,
          resolutionRate: resolutionMetrics.resolutionRate,
        },
        complaintsByStatus: this.formatGroupedData(complaintsStats, 'status'),
        complaintsByCategory: this.formatGroupedData(complaintsStats, 'category'),
        complaintsByUrgency: this.formatGroupedData(urgencyDistribution, 'urgency'),
        technicianPerformance,
        categoryAnalysis,
        monthlyTrends,
        resolutionMetrics,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error generating analytics report:', error);
      throw new InternalServerErrorException('Failed to generate analytics report');
    }
  }

  // Generate technician performance report - FIXED
  async generateTechnicianReport(technicianId: number, startDate: Date, endDate: Date, generatedBy: number) {
    this.validateDateRange(startDate, endDate);

    // Find technician by technicianId (not userId) and include user data
    const technician = await this.prisma.technician.findUnique({
      where: { id: technicianId },
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

    const tasksArr = technician.tasks ?? [];

    const completedTasks = tasksArr.filter(task =>
      task.complaint?.status === ComplaintStatus.RESOLVED
    );
    const inProgressTasks = tasksArr.filter(task =>
      task.complaint?.status === ComplaintStatus.IN_PROGRESS
    );

    // Calculate various metrics
    const totalTasks = tasksArr.length;
    const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

    // Calculate average resolution time (hours)
    const resolutionMetrics = this.calculateTaskResolutionMetrics(completedTasks);

    // Category distribution
    const categoryDistribution = await this.prisma.complaint.groupBy({
      by: ['category'],
      where: {
        tasks: {
          some: {
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

    // Response time analysis (time from complaint creation to task assignment)
    const responseTimeMetrics = await this.calculateResponseTimeMetrics(technicianId, startDate, endDate);

    return {
      technician: {
        id: technician.id,
        userId: technician.user.id,
        name: technician.user.name,
        email: technician.user.email,
        phone: technician.user.phone,
        speciality: technician.speciality,
        status: technician.status,
      },
      period: {
        start: startDate,
        end: endDate,
      },
      performance: {
        totalTasks,
        completedTasks: completedTasks.length,
        inProgressTasks: inProgressTasks.length,
        pendingTasks: totalTasks - completedTasks.length - inProgressTasks.length,
        completionRate: Math.round(completionRate * 100) / 100, // Keep decimals
        averageResolutionTime: resolutionMetrics.averageResolutionTime,
        efficiency: Math.round(completionRate),
        averageResponseTime: responseTimeMetrics.averageResponseTime,
      },
      categoryDistribution,
      monthlyPerformance,
      responseTimeMetrics,
      recentTasks: completedTasks.slice(0, 10).map(task => ({
        id: task.id,
        complaintId: task.complaint?.id,
        title: task.complaint?.title,
        category: task.complaint?.category,
        assignedAt: task.assignedAt,
        resolvedAt: task.complaint?.resolvedAt,
        user: task.complaint?.user?.name ?? 'Unknown',
        resolutionTime: task.complaint?.resolvedAt && task.complaint?.createdAt 
          ? (task.complaint.resolvedAt.getTime() - task.complaint.createdAt.getTime()) / (1000 * 60 * 60 * 24) // days
          : null,
      })),
      generatedAt: new Date(),
    };
  }

  // Enhanced financial report with actual data
  async generateFinancialReport(startDate: Date, endDate: Date, generatedBy: number): Promise<FinancialReportData> {
    this.validateDateRange(startDate, endDate);

    // Calculate revenue based on resolved complaints (placeholder pricing)
    const resolvedComplaints = await this.prisma.complaint.findMany({
      where: {
        status: ComplaintStatus.RESOLVED,
        resolvedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        tasks: {
          include: {
            technician: true,
          },
        },
      },
    });

    // Simple revenue calculation - you can replace with your actual pricing logic
    const revenueByCategory = this.calculateRevenueByCategory(resolvedComplaints);
    const totalRevenue = revenueByCategory.reduce((sum, item) => sum + item.amount, 0);

    // Expense calculation (placeholder - integrate with your actual expense tracking)
    const expenses = await this.calculateExpenses(startDate, endDate);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: { start: startDate, end: endDate },
      revenue: {
        total: totalRevenue,
        byService: revenueByCategory,
      },
      expenses: {
        total: totalExpenses,
        categories: expenses,
      },
      profitability: {
        netProfit,
        margin: Math.round(margin * 100) / 100,
      },
      generatedAt: new Date(),
    };
  }

  // Save report to database
  async saveReport(createReportDto: CreateReportDto, reportData: any) {
    // Validate user exists and has permission to generate reports
    const user = await this.prisma.user.findUnique({
      where: { id: createReportDto.generatedBy },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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

  // Get all saved reports with advanced filtering
  async getSavedReports(page: number = 1, limit: number = 10, type?: ReportType, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { generatedByUser: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          generatedByUser: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { generatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.report.count({ where }),
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
    if(!id || isNaN(id) || id <= 0) {
      throw new BadRequestException('Invalid report ID')
    }
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        generatedByUser: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

//   async exportReport(id: number, format: 'csv' | 'pdf' | 'excel'): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
//   if (!id || isNaN(id) || id <= 0) {
//     throw new BadRequestException('Invalid report ID');
//   }

//   if (!['csv', 'pdf', 'excel'].includes(format)) {
//     throw new BadRequestException('Invalid export format. Use csv, pdf, or excel.');
//   }

//   const report = await this.getReportById(id);
//   const filename = `${report.title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.${format}`;

//   switch (format) {
//     case 'csv':
//       return this.generateCsvReport(report, filename);
//     case 'pdf':
//       return this.generatePdfReport(report, filename);
//     case 'excel':
//       return this.generateExcelReport(report, filename);
//     default:
//       throw new BadRequestException('Invalid export format');
//   }
// }

// private async generateCsvReport(report: any, filename: string): Promise<{buffer: Buffer; filename: string; contentType: string}>{
  
// }
  // Delete report with permission check
  async deleteReport(id: number, userId: number) {
    const report = await this.prisma.report.findUnique({ 
      where: { id },
      include: {
        generatedByUser: {
          select: { id: true }
        }
      }
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Check if user is admin or report owner
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== Role.ADMIN && report.generatedBy !== userId) {
      throw new BadRequestException('You can only delete your own reports');
    }

    return this.prisma.report.delete({ where: { id } });
  }

  // Private helper methods

  private validateDateRange(startDate: Date, endDate: Date) {
    if (startDate > endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (endDate.getTime() - startDate.getTime() > maxRange) {
      throw new BadRequestException('Date range cannot exceed 1 year');
    }
  }

  private async calculateResolutionMetrics(startDate: Date, endDate: Date) {
    const resolvedComplaints = await this.prisma.complaint.findMany({
      where: {
        status: ComplaintStatus.RESOLVED,
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

    const totalComplaints = await this.prisma.complaint.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalResolutionTime = resolvedComplaints.reduce((total, complaint) => {
      if (complaint.resolvedAt && complaint.createdAt) {
        return total + (complaint.resolvedAt.getTime() - complaint.createdAt.getTime());
      }
      return total;
    }, 0);

    const averageResolutionTime = resolvedComplaints.length > 0
      ? totalResolutionTime / resolvedComplaints.length / (1000 * 60 * 60 * 24) // days
      : 0;

    const resolutionRate = totalComplaints > 0
      ? (resolvedComplaints.length / totalComplaints) * 100
      : 0;

    return {
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      totalResolved: resolvedComplaints.length,
      totalComplaints,
    };
  }

  private async getTechnicianPerformance(startDate: Date, endDate: Date): Promise<FormattedTechnicianData[]> {
    // FIXED: Query through Technician model instead of User
    const technicians = await this.prisma.technician.findMany({
      where: {
        tasks: {
          some: {
            assignedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: {
          where: {
            assignedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            complaint: true,
          },
        },
      },
    });

    return technicians.map(tech => {
      const tasks = tech.tasks ?? [];
      const completedTasks = tasks.filter(task =>
        task.complaint?.status === ComplaintStatus.RESOLVED
      );
      const totalTasks = tasks.length;
      const efficiency = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

      return {
        id: tech.user.id,
        name: tech.user.name,
        email: tech.user.email,
        speciality: tech.speciality,
        status: tech.status,
        totalTasks,
        completedTasks: completedTasks.length,
        efficiency: Math.round(efficiency * 100) / 100, // Keep decimals
      };
    });
  }

  private calculateTaskResolutionMetrics(completedTasks: any[]) {
    const totalResolutionTime = completedTasks.reduce((total, task) => {
      if (task.complaint?.resolvedAt && task.complaint?.createdAt) {
        const resolutionTime = task.complaint.resolvedAt.getTime() - task.complaint.createdAt.getTime();
        return total + resolutionTime;
      }
      return total;
    }, 0);

    const averageResolutionTime = completedTasks.length > 0
      ? totalResolutionTime / completedTasks.length / (1000 * 60 * 60) // hours
      : 0;

    return {
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
      totalCompleted: completedTasks.length,
    };
  }

  private async calculateResponseTimeMetrics(technicianId: number, startDate: Date, endDate: Date) {
    const tasks = await this.prisma.task.findMany({
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

    const totalResponseTime = tasks.reduce((total, task) => {
      if (task.assignedAt && task.complaint?.createdAt) {
        const responseTime = task.assignedAt.getTime() - task.complaint.createdAt.getTime();
        return total + responseTime;
      }
      return total;
    }, 0);

    const averageResponseTime = tasks.length > 0
      ? totalResponseTime / tasks.length / (1000 * 60 * 60) // hours
      : 0;

    return {
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      totalTasks: tasks.length,
    };
  }

  private calculateRevenueByCategory(complaints: any[]) {
    // Placeholder pricing - replace with your actual pricing logic
    const pricing: Record<ComplaintCategory, number> = {
        [ComplaintCategory.WATER_LEAK]: 120,
        [ComplaintCategory.NO_WATER]: 150,
        [ComplaintCategory.DIRTY_WATER]: 200,
        [ComplaintCategory.SANITATION]: 100,
        [ComplaintCategory.PIPE_BURST]: 300,
        [ComplaintCategory.DRAINAGE]: 80
    };

    const revenueByCategory = new Map<ComplaintCategory, number>();

    complaints.forEach(complaint => {
      const amount = pricing[complaint.category] || 50;
      const current = revenueByCategory.get(complaint.category) || 0;
      revenueByCategory.set(complaint.category, current + amount);
    });

    return Array.from(revenueByCategory.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));
  }

  private async calculateExpenses(startDate: Date, endDate: Date) {
    // Placeholder - integrate with your actual expense tracking system
    // This could come from a separate Expenses model
    return [
      { name: 'Labor', amount: 5000 },
      { name: 'Materials', amount: 2000 },
      { name: 'Transportation', amount: 800 },
      { name: 'Administrative', amount: 1200 },
    ];
  }

  private async getMonthlyTrends(startDate: Date, endDate: Date) {
    const trends = await this.prisma.complaint.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        id: true,
        status: true,
      },
    });

    const monthlyData = trends.reduce((acc: Record<string, { total: number; resolved: number }>, item) => {
      const month = item.createdAt.toISOString().substring(0, 7);
      if (!acc[month]) acc[month] = { total: 0, resolved: 0 };
      acc[month].total++;
      if (item.status === ComplaintStatus.RESOLVED) acc[month].resolved++;
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      total: data.total,
      resolved: data.resolved,
      resolutionRate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
    }));
  }

  private async getTechnicianMonthlyPerformance(technicianId: number, startDate: Date, endDate: Date) {
    const tasks = await this.prisma.task.findMany({
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

    const monthlyData = tasks.reduce((acc: Record<string, { assigned: number; completed: number }>, task) => {
      const month = task.assignedAt.toISOString().substring(0, 7);
      if (!acc[month]) acc[month] = { assigned: 0, completed: 0 };
      acc[month].assigned++;
      if (task.complaint?.status === ComplaintStatus.RESOLVED) acc[month].completed++;
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      assigned: data.assigned,
      completed: data.completed,
      completionRate: data.assigned > 0 ? Math.round((data.completed / data.assigned) * 100) : 0,
    }));
  }

  private formatGroupedData(data: any[], groupBy: string) {
    return data.reduce((acc: Record<string, number>, item) => {
      const key = (item as any)[groupBy] ?? 'Unknown';
      acc[key] = (acc[key] || 0) + item._count.id;
      return acc;
    }, {});
  }
}