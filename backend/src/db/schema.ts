import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        admin_email VARCHAR(255),
        it_contact VARCHAR(255),
        supervisor_contact VARCHAR(255),
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS supervisors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'supervisor',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        invite_token VARCHAR(255),
        invite_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(team_id, email)
      );

      CREATE TABLE IF NOT EXISTS check_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        final_result VARCHAR(20),
        primary_issue VARCHAR(50),
        attempt_count INTEGER DEFAULT 0,
        escalated BOOLEAN DEFAULT FALSE,
        device_os VARCHAR(100),
        browser VARCHAR(100),
        device_label VARCHAR(255),
        duration_seconds INTEGER
      );

      CREATE TABLE IF NOT EXISTS check_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES check_sessions(id) ON DELETE CASCADE,
        attempt_num INTEGER NOT NULL,
        result VARCHAR(20),
        issue_code VARCHAR(50),
        rms_score FLOAT,
        clipping_score FLOAT,
        noise_score FLOAT,
        echo_score FLOAT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS session_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES check_sessions(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        payload JSONB DEFAULT '{}',
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_check_sessions_agent ON check_sessions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_check_sessions_team ON check_sessions(team_id);
      CREATE INDEX IF NOT EXISTS idx_check_sessions_date ON check_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);
    `);
    console.log('Database schema ready');
  } finally {
    client.release();
  }
}
