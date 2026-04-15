import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDb } from './db/schema';
import { authRouter } from './routes/auth';
import { sessionsRouter } from './routes/sessions';
import { dashboardRouter } from './routes/dashboard';
import { adminRouter } from './routes/admin';
import { reportsRouter } from './routes/reports';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ReadyCheck API', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`ReadyCheck API running on port ${PORT}`);
  });
}
start();

export default app;
