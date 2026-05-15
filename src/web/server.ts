import express from 'express';
import cors from 'cors';
import path from 'path';
import apiRoutes from './api';
import { logger } from '../utils/logger';

export function createWebServer(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', apiRoutes);

  // Serve dashboard static files
  const dashboardPath = path.resolve(__dirname, '../../dashboard/dist');
  app.use(express.static(dashboardPath));

  // SPA fallback: serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dashboardPath, 'index.html'), (err) => {
      if (err) next();
    });
  });

  return app;
}

export function startWebServer(port: number = 3000): Promise<void> {
  const app = createWebServer();
  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`Web 控制面板已启动: http://localhost:${port}`);
      resolve();
    });
  });
}
