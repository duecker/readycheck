import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; teamId: string; role: string; email: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
      id: string; teamId: string; role: string; email: string;
    };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function agentTokenMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.query.token as string || req.body.token;
  if (!token) return res.status(401).json({ error: 'Agent token required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
      agentId: string; teamId: string; type: string;
    };
    if (payload.type !== 'agent-session') return res.status(401).json({ error: 'Invalid token type' });
    (req as any).agentId = payload.agentId;
    (req as any).agentTeamId = payload.teamId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired agent token' });
  }
}
