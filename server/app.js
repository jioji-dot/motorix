// Crea la aplicación Express sin abrir un puerto (así supertest puede ejercitarla).
import express from 'express';
import helmet from 'helmet';
import { cors } from './middlewares/cors.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import authRoutes from './routes/authRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import mechanicRoutes from './routes/mechanicRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import partRoutes from './routes/partRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import userRoutes from './routes/userRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // La API se consume desde otro origen (Flutter web): se permite la lectura entre orígenes.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/mechanics', mechanicRoutes);
  app.use('/api/parts', partRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
