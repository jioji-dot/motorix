import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as maintenanceController from '../controllers/maintenanceController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import {
  createMaintenanceBody,
  listMaintenanceQuery,
  updateMaintenanceBody
} from '../validators/maintenanceValidators.js';

const router = Router();

router.use(authenticate);

// Escritura: administrador y mecánico (el servicio limita al mecánico a las órdenes que tiene asignadas).
const puedeEscribir = authorize(ROLES.ADMIN, ROLES.MECHANIC);

// Listado para avisar a los clientes: solo administración y recepción.
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate({ query: listMaintenanceQuery }),
  maintenanceController.list
);
router.post('/', puedeEscribir, validate({ body: createMaintenanceBody }), maintenanceController.create);
// Detalle: el servicio limita al mecánico a vehículos de sus órdenes asignadas.
router.get('/:id', validate({ params: idParams }), maintenanceController.getById);
router.patch(
  '/:id',
  puedeEscribir,
  validate({ params: idParams, body: updateMaintenanceBody }),
  maintenanceController.update
);
router.post('/:id/complete', puedeEscribir, validate({ params: idParams }), maintenanceController.complete);
router.post('/:id/cancel', puedeEscribir, validate({ params: idParams }), maintenanceController.cancel);

export default router;
