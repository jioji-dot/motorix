import { Router } from 'express';
import * as controlador from '../controllers/dashboardController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// El panel es exclusivo del administrador.
router.get('/', authenticate, authorize('ADMIN'), asyncHandler(controlador.get));

export default router;
