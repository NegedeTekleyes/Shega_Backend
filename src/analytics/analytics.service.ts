import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ChartDataItem {
  name: string;
  totalComplaints: number;
  resolved: number;
  pending: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export interface StatusData {
  name: string;
  value: number;
  color: string;
}

export interface TechnicianPerformance {
  name: string;
  completed: number;
  efficiency: string;
  avgTime: string;
}
export interface DashboardOverview {
  stats: {
    totalComplaints: number;
    resolvedComplaints: number;
    resolutionRate: number;
    avgDailyComplaints: number;
    totalTechnicians: number;
    totalResidents: number;
  };
  chartData: ChartDataItem[];
}

export interface ComprehensiveAnalytics {
  stats: {
    totalComplaints: number;
    resolvedComplaints: number;
    resolutionRate: number;
    avgDailyComplaints: number;
    totalTechnicians: number;
    totalResidents: number;
  };
  chartData: ChartDataItem[];
  byCategory: CategoryData[];
  byStatus: StatusData[];
  topTechnicians: TechnicianPerformance[];
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Get dashboard overview data for the stats cards
  async getDashboardOverview(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalComplaints,
      resolvedComplaints,
      totalTechnicians,
      totalResidents,
      complaintsByDay
    ] = await Promise.all([
      // Total complaints in time range
      this.prisma.complaint.count({
        where: {
          createdAt: { gte: startDate }
        }
      }),

      // Resolved complaints in time range
      this.prisma.complaint.count({
        where: {
          status: 'RESOLVED',
          createdAt: { gte: startDate }
        }
      }),

      // Active technicians
      this.prisma.technician.count({
        where: { status: 'ACTIVE' }
      }),

      // Total residents
      this.prisma.user.count({
        where: { role: 'RESIDENT' }
      }),

      // Daily complaints data for charts
      this.getDailyComplaintsData(days)
    ]);

    const resolutionRate = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;
    const avgDailyComplaints = totalComplaints / days;

    return {
      stats: {
        totalComplaints,
        resolvedComplaints,
        resolutionRate: parseFloat(resolutionRate.toFixed(1)),
        avgDailyComplaints: parseFloat(avgDailyComplaints.toFixed(1)),
        totalTechnicians,
        totalResidents
      },
      chartData: complaintsByDay
    };
  }

  // Generate daily complaints data for the line chart
  private async getDailyComplaintsData(days: number): Promise<ChartDataItem[]> {
    const data: ChartDataItem[] = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      
      // Start and end of the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayComplaints = await this.prisma.complaint.findMany({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      const total = dayComplaints.length;
      const resolved = dayComplaints.filter(c => c.status === 'RESOLVED').length;
      const pending = total - resolved;

      const dayName = date.getDate();
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      data.push({
        name: `${monthName} ${dayName}`,
        totalComplaints: total,
        resolved,
        pending
      });
    }
    
    return data;
  }

  // Get complaints by category for pie chart
  async getComplaintsByCategory(): Promise<CategoryData[]> {
    const categoryData = await this.prisma.complaint.groupBy({
      by: ['category'],
      _count: { id: true }
    });

    // Color mapping for categories
    const colorMap = {
      'Water Quality': '#3B82F6',
      'Pipe Leaks': '#10B981', 
      'Low Pressure': '#F59E0B',
      'No Water': '#EF4444',
      'Sewage Issues': '#8B5CF6',
      'Electrical': '#EC4899',
      'Plumbing': '#06B6D4',
      'HVAC': '#84CC16',
      'Maintenance': '#F97316'
    };

    return categoryData.map(item => ({
      name: item.category,
      value: item._count.id,
      color: colorMap[item.category] || '#6B7280'
    }));
  }

  // Get complaints by status for bar chart
  async getComplaintsByStatus(): Promise<StatusData[]> {
    const statusData = await this.prisma.complaint.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusConfig = {
      'PENDING': { name: 'Pending', color: '#9CA3AF' },
      'SUBMITTED': { name: 'Submitted', color: '#3B82F6' },
      'ASSIGNED': { name: 'Assigned', color: '#F59E0B' },
      'IN_PROGRESS': { name: 'In Progress', color: '#8B5CF6' },
      'RESOLVED': { name: 'Resolved', color: '#10B981' },
      'REJECTED': { name: 'Rejected', color: '#EF4444' }
    };

    return statusData.map(item => ({
      name: statusConfig[item.status]?.name || item.status,
      value: item._count.id,
      color: statusConfig[item.status]?.color || '#6B7280'
    }));
  }

  // Get top performing technicians
  // Get top performing technicians
async getTopTechnicians(limit: number = 3): Promise<TechnicianPerformance[]> {
  try {
    // Get technicians with their tasks and complaint data
    const technicians = await this.prisma.technician.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        tasks: {
          include: {
            complaint: {
              select: {
                id: true,
                status: true,
                createdAt: true,
                resolvedAt: true,
                title: true
              }
            }
          }
        }
      }
    });

    const performanceData = technicians.map(tech => {
      // Handle case where user might be null
      if (!tech.user) {
        return {
          name: 'Unknown Technician',
          completed: 0,
          efficiency: '0%',
          avgTime: 'N/A'
        };
      }

      // Filter completed tasks (RESOLVED complaints)
      const completedTasks = tech.tasks.filter(task => 
        task.complaint?.status === 'RESOLVED'
      );
      
      const totalTasks = tech.tasks.length;
      const efficiency = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

      // Calculate average resolution time
      let avgResolutionTime = 'N/A';
      if (completedTasks.length > 0) {
        const totalHours = completedTasks.reduce((sum, task) => {
          if (!task.complaint?.resolvedAt || !task.complaint?.createdAt) {
            return sum + 24; // Default 24 hours if dates are missing
          }
          const resolutionTime = (task.complaint.resolvedAt.getTime() - task.complaint.createdAt.getTime()) / (1000 * 60 * 60);
          return sum + Math.max(0, resolutionTime); // Ensure non-negative
        }, 0);
        const avgHours = totalHours / completedTasks.length;
        avgResolutionTime = avgHours < 1 ? 
          `${Math.round(avgHours * 60)}m` : 
          `${Math.round(avgHours)}h`;
      }

      return {
        name: tech.user.name || 'Unknown Technician',
        completed: completedTasks.length,
        efficiency: `${Math.round(efficiency)}%`,
        avgTime: avgResolutionTime
      };
    });

    // Sort by completed tasks and return top performers
    return performanceData
      .filter(tech => tech.completed > 0) // Only include technicians with completed tasks
      .sort((a, b) => b.completed - a.completed)
      .slice(0, limit);
  } catch (error) {
    console.error('Error in getTopTechnicians:', error);
    // Return empty array instead of throwing to prevent breaking the dashboard
    return [];
  }
}

  // Get comprehensive analytics data for the entire dashboard
  async getComprehensiveAnalytics(days: number = 30) {
    const [
      dashboardOverview,
      byCategory,
      byStatus,
      topTechnicians
    ] = await Promise.all([
      this.getDashboardOverview(days),
      this.getComplaintsByCategory(),
      this.getComplaintsByStatus(),
      this.getTopTechnicians(3)
    ]);

    return {
      ...dashboardOverview,
      byCategory,
      byStatus,
      topTechnicians
    };
  }
}