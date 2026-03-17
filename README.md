# SecureWatch — Security Log Monitoring App
### B.Tech CSE Resume Project | React Native + Node.js + MongoDB

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  REACT NATIVE (Expo)   →   Node.js/Express   →   MongoDB    │
│  ┌────────────┐            ┌──────────────┐   ┌──────────┐ │
│  │ LoginScreen│──JWT──────▶│ /api/auth    │   │  Users   │ │
│  │ Dashboard  │──Bearer──▶ │ /api/events  │──▶│  Events  │ │
│  │   Screen   │            │ Rate Limiter │   │ Indexes  │ │
│  └────────────┘            │ Helmet CORS  │   └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
security-log-app/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express app + MongoDB connect + seed
│   │   ├── models/
│   │   │   ├── User.js            # bcrypt password hashing, roles
│   │   │   └── SecurityEvent.js   # Full event schema + compound indexes
│   │   ├── routes/
│   │   │   ├── authRoutes.js      # POST /login, /register, GET /me
│   │   │   └── eventRoutes.js     # CRUD + analytics aggregations
│   │   └── middleware/
│   │       └── auth.js            # JWT verify + RBAC
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── App.js                     # Root navigator + auth check
    ├── screens/
    │   ├── LoginScreen.js         # Animated login with JWT auth
    │   └── DashboardScreen.js     # Charts + event feed + KPI cards
    ├── services/
    │   └── api.js                 # Axios instance + SecureStore JWT
    ├── app.json                   # Expo config + APK settings
    └── package.json
```

---

## Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET
npm run dev
# Server runs on http://localhost:5000
# Seed data auto-creates 150 demo events in development mode
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npx expo start
# Press 'a' for Android emulator
# OR install Expo Go on physical device and scan QR
```

### 3. Configure API URL

In `frontend/services/api.js`, set `BASE_URL`:
- **Android Emulator**: `http://10.0.2.2:5000/api`  (emulator → localhost)
- **Physical Device**: `http://YOUR_LAN_IP:5000/api`  (find with `ipconfig` / `ifconfig`)

---

## Building the APK (for Resume / Playstore)

### Method A: Expo EAS Build (Recommended — FREE tier available)

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to Expo account (create free at expo.dev)
eas login

# 3. Configure the project
cd frontend
eas build:configure

# 4. Build APK (preview profile = unsigned APK, perfect for demos)
eas build --platform android --profile preview

# Your APK download link will appear after ~10-15 minutes!
```

### Method B: Local Build

```bash
# Requires Android Studio + JDK 17
cd frontend
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### eas.json (add to frontend/ folder)

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

---

## API Reference

### Authentication

```
POST /api/auth/register
Body: { username, email, password }
Returns: { token, user }

POST /api/auth/login
Body: { email, password }
Returns: { token, user }

GET /api/auth/me
Header: Authorization: Bearer <token>
Returns: { user }
```

### Security Events (All require Bearer JWT)

```
GET /api/events
  ?page=1&limit=20
  &threatLevel=CRITICAL|HIGH|MEDIUM|LOW|INFO
  &status=OPEN|INVESTIGATING|RESOLVED|FALSE_POSITIVE
  &startDate=2024-01-01&endDate=2024-12-31
  &search=<text>

GET /api/events/analytics/threat-levels?days=7
GET /api/events/analytics/summary
GET /api/events/:id
POST /api/events           (admin/analyst only)
PATCH /api/events/:id/status
DELETE /api/events/:id     (admin only)
```

---

## Security Features (Talk About These in Interviews!)

| Feature | Implementation |
|---------|----------------|
| JWT Auth | `jsonwebtoken` with 7-day expiry, stored in iOS/Android SecureStore |
| Password Security | `bcryptjs` with 12 salt rounds |
| Rate Limiting | 10 login attempts / 15 min per IP, 100 req / 15 min globally |
| Input Validation | `express-validator` on all endpoints |
| HTTP Security | `helmet` sets CSP, HSTS, X-Frame-Options headers |
| RBAC | `admin / analyst / viewer` role hierarchy |
| MongoDB Injection | Mongoose schema + parameterized queries |
| CORS | Configured whitelist of allowed origins |

---

## MongoDB vs PostgreSQL

This project ships with **MongoDB + Mongoose**. To switch to PostgreSQL:

1. Add to `.env`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
2. Replace Mongoose models with Sequelize models (Sequelize is already in package.json)
3. Replace `mongoose.connect()` in server.js with:

```js
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER,
  process.env.DB_PASSWORD, { host: process.env.DB_HOST, dialect: 'postgres' });
```

---

## Recruiter Talking Points

- "I used **JWT with SecureStore** to avoid storing tokens in AsyncStorage (which is unencrypted)"
- "The events API uses a **MongoDB aggregation pipeline** for analytics — no N+1 queries"
- "**Rate limiting** on auth routes prevents credential stuffing attacks"
- "**Compound indexes** on `{createdAt, threatLevel}` make dashboard queries fast at scale"
- "The app handles **token expiry gracefully** — the auth middleware intercepts 401 and redirects to login"
