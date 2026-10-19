import { Router } from 'express';
import * as controlador from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/commonValidator.js';
import { createOrderSchema, orderListQuerySchema } from '../validators/orderValidator.js';

const router = Router();

router.use(authenticate);

const todos = authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC');

// El mecánico solo ve las órdenes que tiene asignadas (el servicio lo aplica).
router.get('/', todos, validate(orderListQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', todos, validate(idParamSchema, 'params'), asyncHandler(controlador.get));

// Solo recepción y administración crean órdenes.
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), validate(createOrderSchema), asyncHandler(controlador.create));

export default router;
