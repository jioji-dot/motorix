import { Router } from 'express';
import * as controlador from '../controllers/mechanicController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Recepción y administración eligen mecánico sin necesidad de acceder a la gestión de usuarios.
router.get('/', authenticate, authorize('ADMIN', 'RECEPTIONIST'), asyncHandler(controlador.list));

export default router;
