import { Router } from 'express';
import * as controlador from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { readNoticeSchema } from '../validators/notificationValidator.js';

const router = Router();

// Cada rol recibe solo los tipos de aviso que le corresponden; el filtro lo aplica el servicio.
router.use(authenticate, authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC'));

router.get('/', asyncHandler(controlador.get));
router.post('/read', validate(readNoticeSchema), asyncHandler(controlador.markRead));

export default router;
