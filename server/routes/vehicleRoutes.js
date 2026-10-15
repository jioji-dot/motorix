import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as historyController from '../controllers/historyController.js';
import * as maintenanceController from '../controllers/maintenanceController.js';
import * as vehicleController from '../controllers/vehicleController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams, listQuery } from '../validators/common.js';
import { z } from 'zod';
import {
  createVehicleBody,
  listVehiclesQuery,
  updateVehicleBody
} from '../validators/vehicleValidators.js';

const historyQuery = z.object({ page: listQuery.page, pageSize: listQuery.pageSize });

const router = Router();
const puedeEscribir = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.use(authenticate);

router.get('/', validate({ query: listVehiclesQuery }), vehicleController.list);
router.post('/', puedeEscribir, validate({ body: createVehicleBody }), vehicleController.create);
router.get('/:id', validate({ params: idParams }), vehicleController.getById);

// Historial de servicios: consulta derivada de las órdenes terminadas; todos los roles, solo lectura.
router.get(
  '/:id/history',
  validate({ params: idParams, query: historyQuery }),
  historyController.getVehicleHistory
);

// Mantenimientos del vehículo: lectura para todos los roles.
router.get('/:id/maintenance', validate({ params: idParams }), maintenanceController.listByVehicle);
router.patch(
  '/:id',
  puedeEscribir,
  validate({ params: idParams, body: updateVehicleBody }),
  vehicleController.update
);

export default router;
