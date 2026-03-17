// ─── config/postgres.js ──────────────────────────────────────────────────────
// Drop-in PostgreSQL alternative using Sequelize.
// Swap this for Mongoose by changing server.js imports.
// ─────────────────────────────────────────────────────────────────────────────
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'security_logs',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  }
);

// ── Users table ───────────────────────────────────────────────────────────────
const User = sequelize.define('User', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  email:    { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: false },
  role:     { type: DataTypes.ENUM('admin', 'analyst', 'viewer'), defaultValue: 'viewer' },
  lastLogin:{ type: DataTypes.DATE },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users', underscored: true });

// ── Security Events table ─────────────────────────────────────────────────────
const SecurityEvent = sequelize.define('SecurityEvent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

  eventType: {
    type: DataTypes.ENUM(
      'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'BRUTE_FORCE', 'SQL_INJECTION',
      'XSS_ATTEMPT', 'UNAUTHORIZED_ACCESS', 'PORT_SCAN', 'DATA_EXFILTRATION',
      'MALWARE_DETECTED', 'POLICY_VIOLATION'
    ),
    allowNull: false,
  },
  sourceIP:       { type: DataTypes.INET, allowNull: false },
  destinationIP:  { type: DataTypes.INET },
  port:           { type: DataTypes.INTEGER, validate: { min: 0, max: 65535 } },
  protocol:       { type: DataTypes.ENUM('TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS', 'DNS', 'OTHER') },

  threatLevel: {
    type: DataTypes.ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'),
    allowNull: false,
  },
  threatScore:  { type: DataTypes.INTEGER, defaultValue: 0, validate: { min: 0, max: 100 } },

  userId:     { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
  username:   { type: DataTypes.STRING },
  userAgent:  { type: DataTypes.TEXT },
  requestPath:{ type: DataTypes.STRING },
  statusCode: { type: DataTypes.INTEGER },

  // Geolocation stored as JSON column
  geo: { type: DataTypes.JSONB },

  status: {
    type: DataTypes.ENUM('OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'),
    defaultValue: 'OPEN',
  },
  resolvedBy: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
  resolvedAt: { type: DataTypes.DATE },

  description: { type: DataTypes.TEXT },
  tags:        { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
}, {
  tableName: 'security_events',
  underscored: true,
  indexes: [
    { fields: ['threat_level'] },
    { fields: ['source_ip'] },
    { fields: ['status'] },
    { fields: ['created_at', 'threat_level'] },  // Compound index for dashboard queries
  ],
});

// ── Associations ──────────────────────────────────────────────────────────────
User.hasMany(SecurityEvent, { foreignKey: 'userId', as: 'events' });
SecurityEvent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ── Analytics query (mirrors MongoDB aggregation pipeline) ────────────────────
SecurityEvent.getThreatLevelChart = async (days = 7) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await sequelize.query(`
    SELECT
      DATE(created_at) AS date,
      threat_level,
      COUNT(*) AS count
    FROM security_events
    WHERE created_at >= :since
    GROUP BY DATE(created_at), threat_level
    ORDER BY date ASC
  `, { replacements: { since }, type: Sequelize.QueryTypes.SELECT });

  return results;
};

module.exports = { sequelize, User, SecurityEvent };
