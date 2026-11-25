import { Router } from 'express';
import * as controlador from '../controllers/settingsController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { updateSettingsSchema } from '../validators/settingsValidator.js';

const router = Router();

// La configuración es exclusiva del administrador.
router.use(authenticate, authorize('ADMIN'));

router.get('/', asyncHandler(controlador.get));
router.put('/', validate(updateSettingsSchema), asyncHandler(controlador.update));

export default router;
