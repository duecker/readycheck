import { Router, Response } from 'express';
import { pool } from '../db/schema';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

// GET /api/dashboard/team — team readiness view
dashboardRouter.get('/team', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

  const agents = await pool.query(
    `SELECT 
       a.id, a.name, a.email,
       s.id as session_id,
       s.final_result,
       s.primary_issue,
       s.completed_at,
       s.attempt_count,
       s.escalated,
       s.started_at
     FROM agents a
     LEFT JOIN check_sessions s ON s.agent_id = a.id
       AND s.started_at >= $2::date
       AND s.started_at < ($2::date + INTERVAL '1 day')
       AND s.id = (
         SELECT id FROM check_sessions 
         WHERE agent_id = a.id 
           AND started_at >= $2::date 
           AND started_at < ($2::date + INTERVAL '1 day')
         ORDER BY started_at DESC LIMIT 1
       )
     WHERE a.team_id = $1
     ORDER BY 
       CASE s.final_result
         WHEN NULL THEN 5
         WHEN 'fail' THEN 1
         WHEN 'warn' THEN 2
         WHEN 'escalated' THEN 1
         WHEN 'pass' THEN 4
         ELSE 3
       END,
       a.name`,
    [teamId, date]
  );

  const summary = {
    ready: 0, advisory: 0, notReady: 0, notStarted: 0, total: agents.rows.length
  };
  agents.rows.forEach(a => {
    if (!a.final_result) summary.notStarted++;
    else if (a.final_result === 'pass') summary.ready++;
    else if (a.final_result === 'warn') summary.advisory++;
    else summary.notReady++;
  });

  res.json({ date, summary, agents: agents.rows });
});

// GET /api/dashboard/agent/:agentId/history
dashboardRouter.get('/agent/:agentId/history', async (req: AuthRequest, res: Response) => {
  const { agentId } = req.params;
  const teamId = req.user!.teamId;

  const agent = await pool.query(
    'SELECT id, name, email FROM agents WHERE id = $1 AND team_id = $2',
    [agentId, teamId]
  );
  if (!agent.rows.length) return res.status(404).json({ error: 'Agent not found' });

  const sessions = await pool.query(
    `SELECT s.*, 
       ARRAY(SELECT json_build_object('attempt_num', attempt_num, 'result', result, 'issue_code', issue_code)
             FROM check_attempts WHERE session_id = s.id ORDER BY attempt_num) as attempts
     FROM check_sessions s
     WHERE s.agent_id = $1
     ORDER BY s.started_at DESC
     LIMIT 30`,
    [agentId]
  );

  const stats = await pool.query(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE final_result = 'pass') as passed,
       ROUND(100.0 * COUNT(*) FILTER (WHERE final_result = 'pass') / NULLIF(COUNT(*), 0), 1) as pass_rate,
       mode() WITHIN GROUP (ORDER BY primary_issue) as most_common_issue,
       ROUND(AVG(attempt_count), 1) as avg_attempts
     FROM check_sessions 
     WHERE agent_id = $1 AND started_at >= NOW() - INTERVAL '30 days'`,
    [agentId]
  );

  res.json({ agent: agent.rows[0], sessions: sessions.rows, stats: stats.rows[0] });
});
