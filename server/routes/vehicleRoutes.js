import { Router } from 'express';
import * as historial from '../controllers/historyController.js';
import * as controlador from '../controllers/vehicleController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { historyQuerySchema, idParamSchema } from '../validators/commonValidator.js';
import { createVehicleSchema, updateVehicleSchema, vehicleListQuerySchema } from '../validators/vehicleValidator.js';

const router = Router();
const lectura = authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC');
const escritura = authorize('ADMIN', 'RECEPTIONIST');

router.use(authenticate);

router.get('/', lectura, validate(vehicleListQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', lectura, validate(idParamSchema, 'params'), asyncHandler(controlador.get));
router.get('/:id/history', lectura, validate(idParamSchema, 'params'), validate(historyQuerySchema, 'query'), asyncHandler(historial.vehicleHistory));
router.post('/', escritura, validate(createVehicleSchema), asyncHandler(controlador.create));
router.patch(
  '/:id',
  escritura,
  validate(idParamSchema, 'params'),
  validate(updateVehicleSchema),
  asyncHandler(controlador.update),
);

export default router;
