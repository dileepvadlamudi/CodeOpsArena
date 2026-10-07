import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { setupWebSocket } from './server/socket';
import authRoutes from './server/routes/auth';
import adminRoutes from './server/routes/admin';
import participantRoutes from './server/routes/participant';
import { db } from './server/db';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/participant', participantRoutes);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      contestStatus: db.getStore().contestState.eventStatus,
      currentStage: db.getStore().contestState.currentStage,
      teamsCount: Object.keys(db.getStore().teams).length
    });
  });

  app.get('/api/contest/state', (req, res) => {
    const store = db.getStore();
    res.json({
      success: true,
      state: store.contestState,
      leaderboard: db.getLeaderboard()
    });
  });

  // Setup WebSockets
  setupWebSocket(server);

  // Vite Middleware for SPA
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CodexClub Server] Live & listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
