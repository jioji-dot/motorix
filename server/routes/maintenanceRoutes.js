import { Router } from 'express';
import * as controlador from '../controllers/maintenanceController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/commonValidator.js';
import {
  createMaintenanceSchema,
  maintenanceListQuerySchema,
  updateMaintenanceSchema,
} from '../validators/maintenanceValidator.js';

const router = Router();
const lectura = authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC');
const escritura = authorize('ADMIN', 'MECHANIC');

router.use(authenticate);

router.get('/', lectura, validate(maintenanceListQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', lectura, validate(idParamSchema, 'params'), asyncHandler(controlador.get));
router.post('/', escritura, validate(createMaintenanceSchema), asyncHandler(controlador.create));
router.patch(
  '/:id',
  escritura,
  validate(idParamSchema, 'params'),
  validate(updateMaintenanceSchema),
  asyncHandler(controlador.update),
);

export default router;
