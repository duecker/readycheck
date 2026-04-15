import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/schema';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// POST /api/auth/register — create team + first admin/supervisor
authRouter.post('/register', async (req: Request, res: Response) => {
  const { teamName, name, email, password } = req.body;
  if (!teamName || !name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const teamResult = await client.query(
      'INSERT INTO teams (name, admin_email) VALUES ($1, $2) RETURNING id',
      [teamName, email]
    );
    const teamId = teamResult.rows[0].id;
    const hash = await bcrypt.hash(password, 10);
    const supResult = await client.query(
      'INSERT INTO supervisors (team_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
      [teamId, name, email, hash, 'admin']
    );
    await client.query('COMMIT');
    const token = jwt.sign(
      { id: supResult.rows[0].id, teamId, role: 'admin', email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: supResult.rows[0], teamId, teamName });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const result = await pool.query(
    'SELECT s.*, t.name as team_name FROM supervisors s JOIN teams t ON s.team_id = t.id WHERE s.email = $1',
    [email]
  );
  if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

  const sup = result.rows[0];
  const valid = await bcrypt.compare(password, sup.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: sup.id, teamId: sup.team_id, role: sup.role, email: sup.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: { id: sup.id, name: sup.name, email: sup.email, role: sup.role },
    teamId: sup.team_id,
    teamName: sup.team_name
  });
});

// POST /api/auth/agent-token — generate a magic link token for an agent
authRouter.post('/agent-token', async (req: Request, res: Response) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: 'agentId required' });

  const result = await pool.query('SELECT * FROM agents WHERE id = $1', [agentId]);
  if (!result.rows.length) return res.status(404).json({ error: 'Agent not found' });

  const agent = result.rows[0];
  const token = jwt.sign(
    { agentId: agent.id, teamId: agent.team_id, type: 'agent-session' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, checkUrl: `/check?token=${token}` });
});
