import { Router } from 'express';
import * as controlador from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/commonValidator.js';
import {
  changeStatusSchema,
  createOrderSchema,
  laborSchema,
  lineParamsSchema,
  orderListQuerySchema,
  serviceLineSchema,
  updateLaborSchema,
  updateOrderSchema,
  updateServiceLineSchema,
} from '../validators/orderValidator.js';
import { orderPartSchema, updateOrderPartSchema } from '../validators/partValidator.js';

const router = Router();

router.use(authenticate);

const todos = authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC');

// El mecánico solo ve las órdenes que tiene asignadas (el servicio lo aplica).
router.get('/', todos, validate(orderListQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', todos, validate(idParamSchema, 'params'), asyncHandler(controlador.get));

// Solo recepción y administración crean órdenes.
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), validate(createOrderSchema), asyncHandler(controlador.create));

// El permiso por campo (mecánico asignado o recepción) lo aplica el servicio; aquí solo se exige un rol válido.
router.patch('/:id', todos, validate(idParamSchema, 'params'), validate(updateOrderSchema), asyncHandler(controlador.update));

// Cambio de estado: la máquina de estados decide qué rol y qué asignación puede aplicar cada transición.
router.post('/:id/status', todos, validate(idParamSchema, 'params'), validate(changeStatusSchema), asyncHandler(controlador.changeStatus));

// Servicios y mano de obra: solo el mecánico asignado o el administrador (el servicio comprueba la asignación).
const documenta = authorize('ADMIN', 'MECHANIC');
router.post('/:id/services', documenta, validate(idParamSchema, 'params'), validate(serviceLineSchema), asyncHandler(controlador.addService));
router.patch('/:id/services/:lineId', documenta, validate(lineParamsSchema, 'params'), validate(updateServiceLineSchema), asyncHandler(controlador.updateService));
router.delete('/:id/services/:lineId', documenta, validate(lineParamsSchema, 'params'), asyncHandler(controlador.removeService));
router.post('/:id/labor', documenta, validate(idParamSchema, 'params'), validate(laborSchema), asyncHandler(controlador.addLabor));
router.patch('/:id/labor/:lineId', documenta, validate(lineParamsSchema, 'params'), validate(updateLaborSchema), asyncHandler(controlador.updateLabor));
router.delete('/:id/labor/:lineId', documenta, validate(lineParamsSchema, 'params'), asyncHandler(controlador.removeLabor));

// Refacciones usadas: mismas reglas de asignación; cada cambio mueve el inventario en la misma transacción.
router.post('/:id/parts', documenta, validate(idParamSchema, 'params'), validate(orderPartSchema), asyncHandler(controlador.addPart));
router.patch('/:id/parts/:lineId', documenta, validate(lineParamsSchema, 'params'), validate(updateOrderPartSchema), asyncHandler(controlador.updatePart));
router.delete('/:id/parts/:lineId', documenta, validate(lineParamsSchema, 'params'), asyncHandler(controlador.removePart));

export default router;
