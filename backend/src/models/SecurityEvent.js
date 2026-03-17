// ─── models/SecurityEvent.js ─────────────────────────────────────────────────
const mongoose = require('mongoose');

const geoSchema = new mongoose.Schema(
  {
    country: String,
    city: String,
    lat: Number,
    lon: Number,
  },
  { _id: false }
);

const securityEventSchema = new mongoose.Schema(
  {
    // Core identity
    eventType: {
      type: String,
      required: true,
      enum: [
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'BRUTE_FORCE',
        'SQL_INJECTION',
        'XSS_ATTEMPT',
        'UNAUTHORIZED_ACCESS',
        'PORT_SCAN',
        'DATA_EXFILTRATION',
        'MALWARE_DETECTED',
        'POLICY_VIOLATION',
      ],
      index: true,
    },

    // Network info
    sourceIP: {
      type: String,
      required: true,
      index: true,
      match: [
        /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
        'Invalid IP address',
      ],
    },
    destinationIP: String,
    port: { type: Number, min: 0, max: 65535 },
    protocol: { type: String, enum: ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS', 'DNS', 'OTHER'] },

    // Threat classification
    threatLevel: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
      index: true,
    },
    threatScore: { type: Number, min: 0, max: 100, default: 0 },

    // Context
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    userAgent: String,
    requestPath: String,
    statusCode: Number,

    // Geolocation
    geo: geoSchema,

    // Status tracking
    status: {
      type: String,
      enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'],
      default: 'OPEN',
      index: true,
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,

    // Metadata
    description: String,
    rawPayload: mongoose.Schema.Types.Mixed,
    tags: [String],
  },
  {
    timestamps: true,
    // Automatically add createdAt index for time-range queries
    timeseries: false,
  }
);

// Compound index for common dashboard query patterns
securityEventSchema.index({ createdAt: -1, threatLevel: 1 });
securityEventSchema.index({ sourceIP: 1, createdAt: -1 });
securityEventSchema.index({ status: 1, threatLevel: 1, createdAt: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
