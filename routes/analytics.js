const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analyticsService');
const auth = require('../middleware/auth');

/**
 * Get dashboard metrics
 * GET /api/analytics/dashboard?timeRange=today|week|month
 */
router.get('/dashboard', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { timeRange = 'today' } = req.query;
    const metrics = await AnalyticsService.getDashboardMetrics(timeRange);

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard metrics', error: error.message });
  }
});

/**
 * Get revenue analytics
 * GET /api/analytics/revenue?timeRange=week|month|quarter|year
 */
router.get('/revenue', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { timeRange = 'month' } = req.query;
    const analytics = await AnalyticsService.getRevenueAnalytics(timeRange);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch revenue analytics', error: error.message });
  }
});

/**
 * Get performance analytics
 * GET /api/analytics/performance?timeRange=week|month|quarter
 */
router.get('/performance', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { timeRange = 'month' } = req.query;
    const analytics = await AnalyticsService.getPerformanceAnalytics(timeRange);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Performance analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch performance analytics', error: error.message });
  }
});

/**
 * Get user statistics
 * GET /api/analytics/users?timeRange=week|month|quarter|year
 */
router.get('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { timeRange = 'month' } = req.query;
    const statistics = await AnalyticsService.getUserStatistics(timeRange);

    res.json({
      success: true,
      statistics
    });

  } catch (error) {
    console.error('User statistics error:', error);
    res.status(500).json({ message: 'Failed to fetch user statistics', error: error.message });
  }
});

/**
 * Get service type analytics
 * GET /api/analytics/services?timeRange=week|month|quarter
 */
router.get('/services', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { timeRange = 'month' } = req.query;
    const analytics = await AnalyticsService.getServiceTypeAnalytics(timeRange);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Service analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch service analytics', error: error.message });
  }
});

/**
 * Get comprehensive report (all analytics combined)
 * GET /api/analytics/report?timeRange=month
 */
router.get('/report', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { timeRange = 'month' } = req.query;

    // Fetch all analytics in parallel
    const [dashboard, revenue, performance, users, services] = await Promise.all([
      AnalyticsService.getDashboardMetrics(timeRange),
      AnalyticsService.getRevenueAnalytics(timeRange),
      AnalyticsService.getPerformanceAnalytics(timeRange),
      AnalyticsService.getUserStatistics(timeRange),
      AnalyticsService.getServiceTypeAnalytics(timeRange)
    ]);

    res.json({
      success: true,
      report: {
        dashboard,
        revenue,
        performance,
        users,
        services,
        timeRange,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Comprehensive report error:', error);
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
});

/**
 * Export analytics data as CSV
 * GET /api/analytics/export?type=revenue|bookings|users&timeRange=month
 */
router.get('/export', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { type = 'revenue', timeRange = 'month' } = req.query;

    let data;
    let filename;

    switch (type) {
      case 'revenue':
        data = await AnalyticsService.getRevenueAnalytics(timeRange);
        filename = `revenue_report_${timeRange}_${Date.now()}.json`;
        break;
      case 'performance':
        data = await AnalyticsService.getPerformanceAnalytics(timeRange);
        filename = `performance_report_${timeRange}_${Date.now()}.json`;
        break;
      case 'users':
        data = await AnalyticsService.getUserStatistics(timeRange);
        filename = `user_statistics_${timeRange}_${Date.now()}.json`;
        break;
      default:
        return res.status(400).json({ message: 'Invalid export type' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(data);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Failed to export data', error: error.message });
  }
});

module.exports = router;
