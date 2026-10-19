import { Router } from 'express';
import * as controlador from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createOrderSchema } from '../validators/orderValidator.js';

const router = Router();

router.use(authenticate);

// Solo recepción y administración crean órdenes.
router.post('/', authorize('ADMIN', 'RECEPTIONIST'), validate(createOrderSchema), asyncHandler(controlador.create));

export default router;
