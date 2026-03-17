// ─── routes/eventRoutes.js ────────────────────────────────────────────────────
// Full CRUD + analytics endpoints for Security Events
// All routes require JWT authentication via the `protect` middleware.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const SecurityEvent = require('../models/SecurityEvent');
const { protect, authorize } = require('../middleware/auth');

// Apply auth to ALL routes in this file
router.use(protect);

// ─── Utility ──────────────────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events
// Returns a paginated, filterable list of security events.
//
// Query params:
//   page        (default 1)
//   limit       (default 20, max 100)
//   threatLevel CRITICAL|HIGH|MEDIUM|LOW|INFO
//   eventType   LOGIN_SUCCESS|LOGIN_FAILURE|…
//   status      OPEN|INVESTIGATING|RESOLVED|FALSE_POSITIVE
//   sourceIP    exact IP filter
//   startDate   ISO date string
//   endDate     ISO date string
//   search      text search on description/username
//   sortBy      field name (default: createdAt)
//   sortOrder   asc|desc (default: desc)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('threatLevel').optional().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
    query('status').optional().isIn(['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        threatLevel,
        eventType,
        status,
        sourceIP,
        startDate,
        endDate,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build filter object
      const filter = {};
      if (threatLevel) filter.threatLevel = threatLevel;
      if (eventType) filter.eventType = eventType;
      if (status) filter.status = status;
      if (sourceIP) filter.sourceIP = sourceIP;

      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Text search on description and username
      if (search) {
        filter.$or = [
          { description: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { sourceIP: { $regex: search, $options: 'i' } },
        ];
      }

      const sortObj = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
      const skip = (page - 1) * limit;

      // Execute query + count in parallel
      const [events, total] = await Promise.all([
        SecurityEvent.find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate('userId', 'username email')
          .lean(),
        SecurityEvent.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: events,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (err) {
      console.error('GET /events error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch events.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/analytics/threat-levels
// Returns count of events per threat level for the last N days.
// Used by the React Native chart on the Dashboard screen.
//
// Query params:
//   days  number of past days to include (default 7)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/threat-levels', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Aggregation pipeline: group by date AND threat level
    const pipeline = [
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            threatLevel: '$threatLevel',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    const raw = await SecurityEvent.aggregate(pipeline);

    // Reshape into a chart-friendly format:
    // { labels: ['2024-01-01', ...], datasets: { CRITICAL: [2, 0, ...], HIGH: [...], ... } }
    const labels = [];
    const datasets = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [] };

    // Build label array (last N days, guaranteed continuous)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().split('T')[0]);
    }

    // Build a lookup map from aggregation results
    const lookup = {};
    raw.forEach(({ _id, count }) => {
      if (!lookup[_id.date]) lookup[_id.date] = {};
      lookup[_id.date][_id.threatLevel] = count;
    });

    // Fill datasets — 0 for any missing day/level combination
    Object.keys(datasets).forEach((level) => {
      datasets[level] = labels.map((date) => (lookup[date] && lookup[date][level]) || 0);
    });

    // Also return summary totals
    const totals = {};
    Object.keys(datasets).forEach((level) => {
      totals[level] = datasets[level].reduce((a, b) => a + b, 0);
    });

    res.json({
      success: true,
      data: {
        labels,
        datasets,
        totals,
        period: `Last ${days} days`,
      },
    });
  } catch (err) {
    console.error('Analytics threat-levels error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/analytics/summary
// Returns high-level KPI counts for the dashboard header cards.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalToday,
      openCritical,
      topSourceIPs,
      eventTypeCounts,
    ] = await Promise.all([
      SecurityEvent.countDocuments({ createdAt: { $gte: today } }),
      SecurityEvent.countDocuments({ status: 'OPEN', threatLevel: { $in: ['CRITICAL', 'HIGH'] } }),
      SecurityEvent.aggregate([
        { $group: { _id: '$sourceIP', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      SecurityEvent.aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalEventsToday: totalToday,
        openCriticalAlerts: openCritical,
        topSourceIPs: topSourceIPs.map((x) => ({ ip: x._id, count: x.count })),
        eventTypeCounts: eventTypeCounts.map((x) => ({ type: x._id, count: x.count })),
      },
    });
  } catch (err) {
    console.error('Analytics summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch summary.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events/:id  — single event detail
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', param('id').isMongoId(), validate, async (req, res) => {
  try {
    const event = await SecurityEvent.findById(req.params.id)
      .populate('userId', 'username email')
      .populate('resolvedBy', 'username');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch event.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events  — create a new security event (admin/analyst only)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  authorize('admin', 'analyst'),
  [
    body('eventType').isIn([
      'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'BRUTE_FORCE', 'SQL_INJECTION',
      'XSS_ATTEMPT', 'UNAUTHORIZED_ACCESS', 'PORT_SCAN', 'DATA_EXFILTRATION',
      'MALWARE_DETECTED', 'POLICY_VIOLATION',
    ]),
    body('sourceIP').matches(/^(\d{1,3}\.){3}\d{1,3}$/).withMessage('Valid IPv4 required'),
    body('threatLevel').isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
    body('description').optional().isString().trim().isLength({ max: 1000 }),
  ],
  validate,
  async (req, res) => {
    try {
      const event = await SecurityEvent.create(req.body);
      res.status(201).json({ success: true, data: event });
    } catch (err) {
      console.error('POST /events error:', err);
      res.status(500).json({ success: false, message: 'Failed to create event.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/events/:id/status  — update investigation status
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/:id/status',
  authorize('admin', 'analyst'),
  [
    param('id').isMongoId(),
    body('status').isIn(['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE']),
  ],
  validate,
  async (req, res) => {
    try {
      const update = { status: req.body.status };
      if (req.body.status === 'RESOLVED') {
        update.resolvedBy = req.user._id;
        update.resolvedAt = new Date();
      }
      const event = await SecurityEvent.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
      res.json({ success: true, data: event });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/events/:id  — admin only
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  authorize('admin'),
  param('id').isMongoId(),
  validate,
  async (req, res) => {
    try {
      const event = await SecurityEvent.findByIdAndDelete(req.params.id);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
      res.json({ success: true, message: 'Event deleted successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to delete event.' });
    }
  }
);

module.exports = router;
