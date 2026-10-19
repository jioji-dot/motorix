// Aplicación Express: rutas bajo /api y manejo centralizado de errores.
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok' } }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
