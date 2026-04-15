import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/schema';
import { agentTokenMiddleware, AuthRequest } from '../middleware/auth';

export const sessionsRouter = Router();

// POST /api/sessions/start — agent starts a check session
sessionsRouter.post('/start', agentTokenMiddleware, async (req: AuthRequest, res: Response) => {
  const agentId = (req as any).agentId;
  const teamId = (req as any).agentTeamId;
  const { deviceOs, browser, deviceLabel } = req.body;

  // Check if already passed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await pool.query(
    `SELECT * FROM check_sessions 
     WHERE agent_id = $1 AND started_at >= $2 AND final_result = 'pass'
     ORDER BY started_at DESC LIMIT 1`,
    [agentId, today]
  );

  const agent = await pool.query(
    'SELECT a.*, t.it_contact, t.supervisor_contact FROM agents a JOIN teams t ON a.team_id = t.id WHERE a.id = $1',
    [agentId]
  );
  if (!agent.rows.length) return res.status(404).json({ error: 'Agent not found' });

  if (existing.rows.length) {
    return res.json({
      alreadyPassed: true,
      session: existing.rows[0],
      agent: { id: agent.rows[0].id, name: agent.rows[0].name },
      contacts: { it: agent.rows[0].it_contact, supervisor: agent.rows[0].supervisor_contact }
    });
  }

  const result = await pool.query(
    `INSERT INTO check_sessions (agent_id, team_id, device_os, browser, device_label)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [agentId, teamId, deviceOs, browser, deviceLabel]
  );

  // Log start event
  await pool.query(
    `INSERT INTO session_events (session_id, event_type, payload) VALUES ($1, $2, $3)`,
    [result.rows[0].id, 'session_started', JSON.stringify({ deviceOs, browser, deviceLabel })]
  );

  res.json({
    session: result.rows[0],
    agent: { id: agent.rows[0].id, name: agent.rows[0].name },
    contacts: { it: agent.rows[0].it_contact, supervisor: agent.rows[0].supervisor_contact }
  });
});

// POST /api/sessions/:id/attempt — log a scoring attempt
sessionsRouter.post('/:id/attempt', agentTokenMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { result, issueCode, rmsScore, clippingScore, noiseScore, echoScore } = req.body;

  // Increment attempt count
  await pool.query(
    'UPDATE check_sessions SET attempt_count = attempt_count + 1 WHERE id = $1',
    [id]
  );

  const session = await pool.query('SELECT attempt_count FROM check_sessions WHERE id = $1', [id]);
  const attemptNum = session.rows[0]?.attempt_count || 1;

  const attempt = await pool.query(
    `INSERT INTO check_attempts (session_id, attempt_num, result, issue_code, rms_score, clipping_score, noise_score, echo_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, attemptNum, result, issueCode, rmsScore, clippingScore, noiseScore, echoScore]
  );

  await pool.query(
    `INSERT INTO session_events (session_id, event_type, payload) VALUES ($1, $2, $3)`,
    [id, 'attempt_recorded', JSON.stringify({ attemptNum, result, issueCode })]
  );

  res.json({ attempt: attempt.rows[0], attemptNum });
});

// POST /api/sessions/:id/complete — finalize session
sessionsRouter.post('/:id/complete', agentTokenMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { finalResult, primaryIssue, escalated, durationSeconds } = req.body;

  const result = await pool.query(
    `UPDATE check_sessions 
     SET final_result = $1, primary_issue = $2, escalated = $3, 
         duration_seconds = $4, completed_at = NOW()
     WHERE id = $5 RETURNING *`,
    [finalResult, primaryIssue, escalated || false, durationSeconds, id]
  );

  await pool.query(
    `INSERT INTO session_events (session_id, event_type, payload) VALUES ($1, $2, $3)`,
    [id, 'session_completed', JSON.stringify({ finalResult, primaryIssue, escalated })]
  );

  res.json({ session: result.rows[0] });
});

// POST /api/sessions/:id/escalate
sessionsRouter.post('/:id/escalate', agentTokenMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await pool.query(
    `UPDATE check_sessions SET escalated = TRUE WHERE id = $1`,
    [id]
  );
  await pool.query(
    `INSERT INTO session_events (session_id, event_type, payload) VALUES ($1, $2, $3)`,
    [id, 'escalated', JSON.stringify({})]
  );
  res.json({ success: true });
});
