import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { pool } from '../db/schema';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const adminRouter = Router();
adminRouter.use(authMiddleware);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// GET /api/admin/agents — list all agents on team
adminRouter.get('/agents', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const result = await pool.query(
    'SELECT id, name, email, created_at FROM agents WHERE team_id = $1 ORDER BY name',
    [teamId]
  );
  res.json({ agents: result.rows });
});

// POST /api/admin/agents — invite single agent
adminRouter.post('/agents', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });

  const token = jwt.sign(
    { agentId: 'pending', teamId, type: 'agent-session' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  try {
    const result = await pool.query(
      `INSERT INTO agents (team_id, name, email, invite_token, invite_expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days') RETURNING id, name, email`,
      [teamId, name, email, token]
    );

    // Regenerate token with real agentId
    const agentId = result.rows[0].id;
    const realToken = jwt.sign(
      { agentId, teamId, type: 'agent-session' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    await pool.query(
      'UPDATE agents SET invite_token = $1 WHERE id = $2',
      [realToken, agentId]
    );

    res.json({
      agent: result.rows[0],
      checkUrl: `/check?token=${realToken}`,
      token: realToken
    });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Agent with that email already exists on this team' });
    throw err;
  }
});

// POST /api/admin/agents/import — CSV bulk import
adminRouter.post('/agents/import', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const { agents } = req.body; // Array of { name, email }
  if (!Array.isArray(agents) || !agents.length)
    return res.status(400).json({ error: 'agents array required' });

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const a of agents) {
    if (!a.name || !a.email) { results.errors.push(`Invalid entry: ${JSON.stringify(a)}`); continue; }
    try {
      const insert = await pool.query(
        `INSERT INTO agents (team_id, name, email, invite_token, invite_expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
         ON CONFLICT (team_id, email) DO NOTHING RETURNING id`,
        [teamId, a.name, a.email, 'pending']
      );
      if (insert.rows.length) {
        const agentId = insert.rows[0].id;
        const token = jwt.sign({ agentId, teamId, type: 'agent-session' }, JWT_SECRET, { expiresIn: '12h' });
        await pool.query('UPDATE agents SET invite_token = $1 WHERE id = $2', [token, agentId]);
        results.created++;
      } else {
        results.skipped++;
      }
    } catch {
      results.errors.push(`Failed: ${a.email}`);
    }
  }

  res.json(results);
});

// GET /api/admin/team — get team settings
adminRouter.get('/team', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const result = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
  if (!result.rows.length) return res.status(404).json({ error: 'Team not found' });
  res.json({ team: result.rows[0] });
});

// PATCH /api/admin/team — update team settings
adminRouter.patch('/team', async (req: AuthRequest, res: Response) => {
  const teamId = req.user!.teamId;
  const { name, itContact, supervisorContact } = req.body;
  const result = await pool.query(
    `UPDATE teams SET 
       name = COALESCE($1, name),
       it_contact = COALESCE($2, it_contact),
       supervisor_contact = COALESCE($3, supervisor_contact)
     WHERE id = $4 RETURNING *`,
    [name, itContact, supervisorContact, teamId]
  );
  res.json({ team: result.rows[0] });
});

// GET /api/admin/agent-link/:agentId — get fresh check link for agent
adminRouter.get('/agent-link/:agentId', async (req: AuthRequest, res: Response) => {
  const { agentId } = req.params;
  const teamId = req.user!.teamId;
  const agent = await pool.query(
    'SELECT id, name, email, team_id FROM agents WHERE id = $1 AND team_id = $2',
    [agentId, teamId]
  );
  if (!agent.rows.length) return res.status(404).json({ error: 'Agent not found' });
  const token = jwt.sign(
    { agentId, teamId, type: 'agent-session' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ checkUrl: `/check?token=${token}`, token });
});
