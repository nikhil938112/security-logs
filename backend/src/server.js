// ─── server.js ───────────────────────────────────────────────────────────────
// Entry point for the Security Log Monitoring API
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());                  // Secure HTTP headers
app.use(cors({
  origin: ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:19000', '*'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));
app.options('*', cors());

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);

// ─── General Middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));   // Body size limit prevents payload attacks
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Health check
app.get('/health', (req, res) =>
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() })
);

// 404 handler
app.use('*', (req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` })
);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

// ─── Database Connection ──────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅  MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// ─── Seed Demo Data (development only) ───────────────────────────────────────
const seedDemoData = async () => {
  if (process.env.NODE_ENV !== 'development') return;
  const SecurityEvent = require('./models/SecurityEvent');
  const count = await SecurityEvent.countDocuments();
  if (count > 0) return;   // Already seeded

  const eventTypes = [
    'LOGIN_FAILURE', 'BRUTE_FORCE', 'SQL_INJECTION', 'XSS_ATTEMPT',
    'UNAUTHORIZED_ACCESS', 'PORT_SCAN', 'LOGIN_SUCCESS', 'MALWARE_DETECTED',
  ];
  const threatLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const ips = ['192.168.1.1', '10.0.0.55', '203.0.113.42', '198.51.100.7', '172.16.0.1'];

  const events = Array.from({ length: 150 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 14));
    date.setHours(Math.floor(Math.random() * 24));
    return {
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      sourceIP: ips[Math.floor(Math.random() * ips.length)],
      threatLevel: threatLevels[Math.floor(Math.random() * threatLevels.length)],
      threatScore: Math.floor(Math.random() * 100),
      description: `Automated seed event ${i + 1}`,
      status: ['OPEN', 'INVESTIGATING', 'RESOLVED'][Math.floor(Math.random() * 3)],
      createdAt: date,
    };
  });

  await SecurityEvent.insertMany(events);
  console.log(`🌱  Seeded ${events.length} demo security events.`);
};

// ─── Start Server ─────────────────────────────────────────────────────────────
connectDB().then(async () => {
  await seedDemoData();
  app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
    console.log(`📋  Environment: ${process.env.NODE_ENV}`);
  });
});

module.exports = app;
