# ReadyCheck — Codebase

Pre-shift audio readiness for contact centers.

## Structure

  frontend/   React + Vite + TypeScript SPA
  backend/    Node.js + Express + TypeScript API

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (local or Railway/Render)

### 1. Backend

  cd backend
  cp .env.example .env
  # Edit .env — set DATABASE_URL and JWT_SECRET
  npm install
  npm run dev       # Starts on port 3001

The first time the backend starts, it will create all database tables automatically.

### 2. Frontend

  cd frontend
  npm install
  npm run dev       # Starts on port 5173, proxies /api to localhost:3001

### 3. Open the app

  Landing page:   http://localhost:5173/
  Agent check:    http://localhost:5173/check?demo=1
  Register:       http://localhost:5173/register
  Dashboard:      http://localhost:5173/dashboard  (after registering)
  Admin:          http://localhost:5173/admin

## Pages

  /                  Landing page + pilot CTA
  /check?demo=1      Agent check flow (demo mode, no token required)
  /check?token=XXX   Agent check flow (production — token from admin panel)
  /login             Supervisor / admin login
  /register          Create new team account
  /dashboard         Supervisor team readiness dashboard
  /admin             Admin — manage agents, import CSV, copy check links

## Key Files

  frontend/src/lib/audioScoring.ts      Client-side audio DSP and scoring engine
  frontend/src/lib/remediationContent.ts  Remediation steps per issue type
  frontend/src/pages/CheckFlow.tsx      Full agent check state machine
  frontend/src/pages/Dashboard.tsx      Supervisor dashboard
  backend/src/db/schema.ts             Database schema and init
  backend/src/routes/sessions.ts       Agent session API
  backend/src/routes/dashboard.ts      Supervisor data API

## Audio Scoring

All audio analysis runs in the browser (no audio sent to server).
Scores transmitted to server: RMS level, clipping rate, noise floor, echo score.
Raw audio: never stored.

Failure detection:
  F1 Low Volume     — RMS < -40 dBFS
  F2 Clipping       — > 1% of samples at peak
  F3 Background     — Noise floor > -30 dBFS
  F4 Echo           — Autocorrelation > 0.3 at 50-400ms lag
  F5 Wrong Mic      — Device label contains "Internal/Built-in/Laptop"
  F7 Dropout        — Silence windows > 150ms during speech

## Environment Variables

  PORT             API port (default 3001)
  DATABASE_URL     PostgreSQL connection string
  JWT_SECRET       Secret for signing JWTs — must be long and random in production
  NODE_ENV         development | production
  FRONTEND_URL     Frontend origin for CORS (e.g. http://localhost:5173)
  SMTP_*           Email settings (optional for MVP — check links sent manually)

## Deployment

Frontend: Deploy dist/ to Vercel (vite build → Vercel)
Backend: Deploy to Railway or Render (Node.js + PostgreSQL)

See 05_technical/architecture.md for full deployment guide.
