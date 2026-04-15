import { Router, Response } from 'express';
import { pool } from '../db/schema';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const reportsRouter = Router();
reportsRouter.use(authMiddleware);

// GET /api/reports/issues?days=7
reportsRouter.get('/issues', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const days = parseInt(req.query.days as string) || 7;

  const result = await pool.query(
    `SELECT 
       primary_issue,
       COUNT(*) as count,
       ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) as pct,
       ROUND(AVG(attempt_count), 1) as avg_attempts_to_resolve,
       COUNT(*) FILTER (WHERE escalated = TRUE) as escalated_count
     FROM check_sessions
     WHERE team_id = $1 
       AND started_at >= NOW() - ($2 || ' days')::INTERVAL
       AND primary_issue IS NOT NULL
     GROUP BY primary_issue
     ORDER BY count DESC`,
    [teamId, days]
  );

  res.json({ days, issues: result.rows });
});

// GET /api/reports/compliance?days=30
reportsRouter.get('/compliance', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const days = parseInt(req.query.days as string) || 30;

  const totalAgents = await pool.query(
    'SELECT COUNT(*) as total FROM agents WHERE team_id = $1',
    [teamId]
  );

  const daily = await pool.query(
    `SELECT 
       started_at::date as date,
       COUNT(DISTINCT agent_id) as checks_completed,
       $2::integer as total_agents,
       ROUND(100.0 * COUNT(DISTINCT agent_id) / $2, 1) as compliance_pct
     FROM check_sessions
     WHERE team_id = $1 AND started_at >= NOW() - ($3 || ' days')::INTERVAL
     GROUP BY started_at::date
     ORDER BY date DESC`,
    [teamId, totalAgents.rows[0].total, days]
  );

  const neverChecked = await pool.query(
    `SELECT a.id, a.name, a.email
     FROM agents a
     WHERE a.team_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM check_sessions s 
         WHERE s.agent_id = a.id 
           AND s.started_at >= NOW() - ($2 || ' days')::INTERVAL
       )
     ORDER BY a.name`,
    [teamId, days]
  );

  res.json({
    days,
    totalAgents: parseInt(totalAgents.rows[0].total),
    daily: daily.rows,
    neverChecked: neverChecked.rows
  });
});

// GET /api/reports/audit?from=&to=&result=&issue=
reportsRouter.get('/audit', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const from = req.query.from as string || new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
  const to = req.query.to as string || new Date().toISOString().split('T')[0];
  const resultFilter = req.query.result as string;
  const issueFilter = req.query.issue as string;

  let query = `
    SELECT s.id, s.started_at, s.completed_at, s.final_result, s.primary_issue,
           s.attempt_count, s.escalated, s.device_os, s.browser, s.device_label,
           s.duration_seconds,
           a.name as agent_name, a.email as agent_email
    FROM check_sessions s
    JOIN agents a ON s.agent_id = a.id
    WHERE s.team_id = $1
      AND s.started_at >= $2::date
      AND s.started_at < ($3::date + INTERVAL '1 day')
  `;
  const params: any[] = [teamId, from, to];

  if (resultFilter) { params.push(resultFilter); query += ` AND s.final_result = $${params.length}`; }
  if (issueFilter) { params.push(issueFilter); query += ` AND s.primary_issue = $${params.length}`; }
  query += ' ORDER BY s.started_at DESC LIMIT 1000';

  const result = await pool.query(query, params);
  res.json({ from, to, count: result.rows.length, sessions: result.rows });
});
