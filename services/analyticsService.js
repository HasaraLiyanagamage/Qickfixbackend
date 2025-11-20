/**
 * Analytics Service
 * Comprehensive analytics for admin dashboard
 */

const Booking = require('../models/Booking');
const User = require('../models/User');
const Technician = require('../models/Technician');
const Verification = require('../models/Verification');

class AnalyticsService {
  /**
   * Get dashboard overview metrics
   */
  static async getDashboardMetrics(timeRange = 'today') {
    const { startDate, endDate } = this.getDateRange(timeRange);

    // Parallel queries for better performance
    const [
      totalBookings,
      completedBookings,
      activeBookings,
      cancelledBookings,
      totalRevenue,
      totalUsers,
      totalTechnicians,
      verifiedTechnicians,
      newUsersToday,
      newTechniciansToday,
      averageRating,
      emergencyBookings
    ] = await Promise.all([
      // Total bookings in range
      Booking.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      
      // Completed bookings
      Booking.countDocuments({
        status: 'completed',
        'tracking.completedAt': { $gte: startDate, $lte: endDate }
      }),
      
      // Active bookings (in progress)
      Booking.countDocuments({
        status: { $in: ['requested', 'matched', 'accepted', 'in_progress', 'arrived'] }
      }),
      
      // Cancelled bookings
      Booking.countDocuments({
        status: 'cancelled',
        'cancellation.cancelledAt': { $gte: startDate, $lte: endDate }
      }),
      
      // Total revenue
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            'tracking.completedAt': { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.totalFare' }
          }
        }
      ]),
      
      // Total users
      User.countDocuments({ role: 'user' }),
      
      // Total technicians
      Technician.countDocuments(),
      
      // Verified technicians
      Technician.countDocuments({ 'verification.isVerified': true }),
      
      // New users today
      User.countDocuments({
        role: 'user',
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      
      // New technicians today
      Technician.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      
      // Average rating
      Booking.aggregate([
        {
          $match: {
            'rating.score': { $exists: true },
            'rating.ratedAt': { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating.score' }
          }
        }
      ]),
      
      // Emergency bookings
      Booking.countDocuments({
        'emergency.isEmergency': true,
        createdAt: { $gte: startDate, $lte: endDate }
      })
    ]);

    return {
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        active: activeBookings,
        cancelled: cancelledBookings,
        completionRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(2) : 0,
        cancellationRate: totalBookings > 0 ? ((cancelledBookings / totalBookings) * 100).toFixed(2) : 0
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        currency: 'LKR',
        averagePerBooking: completedBookings > 0 ? ((totalRevenue[0]?.total || 0) / completedBookings).toFixed(2) : 0
      },
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        growthRate: totalUsers > 0 ? ((newUsersToday / totalUsers) * 100).toFixed(2) : 0
      },
      technicians: {
        total: totalTechnicians,
        verified: verifiedTechnicians,
        newToday: newTechniciansToday,
        verificationRate: totalTechnicians > 0 ? ((verifiedTechnicians / totalTechnicians) * 100).toFixed(2) : 0
      },
      performance: {
        averageRating: averageRating[0]?.avgRating?.toFixed(2) || 0,
        emergencyBookings: emergencyBookings
      },
      timeRange,
      generatedAt: new Date()
    };
  }

  /**
   * Get revenue analytics
   */
  static async getRevenueAnalytics(timeRange = 'month') {
    const { startDate, endDate } = this.getDateRange(timeRange);

    // Revenue by day/week/month
    const revenueOverTime = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          'tracking.completedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$tracking.completedAt' },
            month: { $month: '$tracking.completedAt' },
            day: { $dayOfMonth: '$tracking.completedAt' }
          },
          revenue: { $sum: '$pricing.totalFare' },
          bookings: { $sum: 1 },
          avgBookingValue: { $avg: '$pricing.totalFare' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Revenue by service type
    const revenueByService = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          'tracking.completedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$serviceType',
          revenue: { $sum: '$pricing.totalFare' },
          bookings: { $sum: 1 },
          avgRevenue: { $avg: '$pricing.totalFare' }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);

    // Revenue by payment method
    const revenueByPaymentMethod = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          'tracking.completedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$payment.method',
          revenue: { $sum: '$pricing.totalFare' },
          bookings: { $sum: 1 }
        }
      }
    ]);

    // Top revenue generating technicians
    const topTechnicians = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          'tracking.completedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$technician',
          revenue: { $sum: '$pricing.totalFare' },
          bookings: { $sum: 1 },
          avgRating: { $avg: '$rating.score' }
        }
      },
      {
        $sort: { revenue: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'technicians',
          localField: '_id',
          foreignField: '_id',
          as: 'technicianData'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'technicianData.user',
          foreignField: '_id',
          as: 'userData'
        }
      }
    ]);

    // Calculate totals
    const totalRevenue = revenueOverTime.reduce((sum, item) => sum + item.revenue, 0);
    const totalBookings = revenueOverTime.reduce((sum, item) => sum + item.bookings, 0);

    return {
      summary: {
        totalRevenue,
        totalBookings,
        averageBookingValue: totalBookings > 0 ? (totalRevenue / totalBookings).toFixed(2) : 0,
        currency: 'LKR'
      },
      revenueOverTime,
      revenueByService,
      revenueByPaymentMethod,
      topTechnicians: topTechnicians.map(t => ({
        technicianId: t._id,
        name: t.userData[0]?.name || 'Unknown',
        revenue: t.revenue,
        bookings: t.bookings,
        avgRating: t.avgRating?.toFixed(2) || 0
      })),
      timeRange,
      generatedAt: new Date()
    };
  }

  /**
   * Get performance analytics
   */
  static async getPerformanceAnalytics(timeRange = 'month') {
    const { startDate, endDate } = this.getDateRange(timeRange);

    // Response time analytics
    const responseTimeStats = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['accepted', 'in_progress', 'completed'] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$tracking.arrivedAt', '$requestedAt'] },
              1000 * 60 // Convert to minutes
            ]
          },
          urgency: 1
        }
      },
      {
        $group: {
          _id: '$urgency',
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Completion time analytics
    const completionTimeStats = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          'tracking.completedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          completionTime: {
            $divide: [
              { $subtract: ['$tracking.completedAt', '$tracking.startedAt'] },
              1000 * 60 // Convert to minutes
            ]
          },
          serviceType: 1
        }
      },
      {
        $group: {
          _id: '$serviceType',
          avgCompletionTime: { $avg: '$completionTime' },
          minCompletionTime: { $min: '$completionTime' },
          maxCompletionTime: { $max: '$completionTime' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Rating distribution
    const ratingDistribution = await Booking.aggregate([
      {
        $match: {
          'rating.score': { $exists: true },
          'rating.ratedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$rating.score',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    // Technician performance
    const technicianPerformance = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          'tracking.completedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$technician',
          totalBookings: { $sum: 1 },
          avgRating: { $avg: '$rating.score' },
          totalRevenue: { $sum: '$pricing.totalFare' },
          completionRate: {
            $avg: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { avgRating: -1 }
      },
      {
        $limit: 20
      }
    ]);

    // Booking trends by hour
    const bookingsByHour = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Booking trends by day of week
    const bookingsByDayOfWeek = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    return {
      responseTime: responseTimeStats,
      completionTime: completionTimeStats,
      ratingDistribution,
      technicianPerformance,
      bookingTrends: {
        byHour: bookingsByHour,
        byDayOfWeek: bookingsByDayOfWeek
      },
      timeRange,
      generatedAt: new Date()
    };
  }

  /**
   * Get user statistics
   */
  static async getUserStatistics(timeRange = 'month') {
    const { startDate, endDate } = this.getDateRange(timeRange);

    // User growth over time
    const userGrowth = await User.aggregate([
      {
        $match: {
          role: 'user',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          newUsers: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Active users (users with bookings)
    const activeUsers = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          bookingCount: { $sum: 1 },
          totalSpent: { $sum: '$pricing.totalFare' },
          lastBooking: { $max: '$createdAt' }
        }
      },
      {
        $sort: { bookingCount: -1 }
      }
    ]);

    // User retention (repeat customers)
    const repeatCustomers = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          bookingCount: { $sum: 1 }
        }
      },
      {
        $match: {
          bookingCount: { $gt: 1 }
        }
      },
      {
        $count: 'repeatCustomers'
      }
    ]);

    // Top customers by spending
    const topCustomers = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          'tracking.completedAt': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$pricing.totalFare' },
          bookings: { $sum: 1 },
          avgSpending: { $avg: '$pricing.totalFare' }
        }
      },
      {
        $sort: { totalSpent: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userData'
        }
      }
    ]);

    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalActiveUsers = activeUsers.length;
    const totalRepeatCustomers = repeatCustomers[0]?.repeatCustomers || 0;

    return {
      summary: {
        totalUsers,
        activeUsers: totalActiveUsers,
        repeatCustomers: totalRepeatCustomers,
        retentionRate: totalActiveUsers > 0 ? ((totalRepeatCustomers / totalActiveUsers) * 100).toFixed(2) : 0,
        activationRate: totalUsers > 0 ? ((totalActiveUsers / totalUsers) * 100).toFixed(2) : 0
      },
      userGrowth,
      topCustomers: topCustomers.map(c => ({
        userId: c._id,
        name: c.userData[0]?.name || 'Unknown',
        email: c.userData[0]?.email,
        totalSpent: c.totalSpent,
        bookings: c.bookings,
        avgSpending: c.avgSpending.toFixed(2)
      })),
      activeUserSegments: {
        highValue: activeUsers.filter(u => u.totalSpent > 10000).length,
        medium: activeUsers.filter(u => u.totalSpent >= 5000 && u.totalSpent <= 10000).length,
        low: activeUsers.filter(u => u.totalSpent < 5000).length
      },
      timeRange,
      generatedAt: new Date()
    };
  }

  /**
   * Get service type analytics
   */
  static async getServiceTypeAnalytics(timeRange = 'month') {
    const { startDate, endDate } = this.getDateRange(timeRange);

    const serviceStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$serviceType',
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalRevenue: { $sum: '$pricing.totalFare' },
          avgRevenue: { $avg: '$pricing.totalFare' },
          avgRating: { $avg: '$rating.score' }
        }
      },
      {
        $sort: { totalBookings: -1 }
      }
    ]);

    return {
      services: serviceStats.map(s => ({
        serviceType: s._id,
        bookings: s.totalBookings,
        completed: s.completedBookings,
        cancelled: s.cancelledBookings,
        completionRate: s.totalBookings > 0 ? ((s.completedBookings / s.totalBookings) * 100).toFixed(2) : 0,
        revenue: s.totalRevenue,
        avgRevenue: s.avgRevenue?.toFixed(2) || 0,
        avgRating: s.avgRating?.toFixed(2) || 0
      })),
      timeRange,
      generatedAt: new Date()
    };
  }

  /**
   * Helper: Get date range based on time period
   */
  static getDateRange(timeRange) {
    const now = new Date();
    let startDate, endDate = new Date();

    switch (timeRange) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }

    console.log(`Date Range for ${timeRange}: ${startDate} to ${endDate}`);
    return { startDate, endDate };
  }
}

module.exports = AnalyticsService;
