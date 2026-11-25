import { Router } from 'express';
import * as controlador from '../controllers/serviceTypeController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/commonValidator.js';
import { createServiceTypeSchema, updateServiceTypeSchema } from '../validators/serviceTypeValidator.js';

const router = Router();

router.use(authenticate);

// Lectura para los tres roles (los no administradores reciben solo los activos); escritura solo del administrador.
router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC'), asyncHandler(controlador.list));
router.post('/', authorize('ADMIN'), validate(createServiceTypeSchema), asyncHandler(controlador.create));
router.patch('/:id', authorize('ADMIN'), validate(idParamSchema, 'params'), validate(updateServiceTypeSchema), asyncHandler(controlador.update));

export default router;
