import { Router } from 'express';
import * as controlador from '../controllers/auditController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { auditListQuerySchema } from '../validators/auditValidator.js';

const router = Router();

// Solo lectura y solo del administrador: no hay rutas para editar, borrar ni exportar la bitácora.
router.get('/', authenticate, authorize('ADMIN'), validate(auditListQuerySchema, 'query'), asyncHandler(controlador.list));

export default router;
