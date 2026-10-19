import { Router } from 'express';
import * as controlador from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/commonValidator.js';

const router = Router();
const cobranza = authorize('ADMIN', 'RECEPTIONIST');

// Única ruta sin sesión: la notificación de Mercado Pago. El servidor verifica el pago real contra Mercado Pago.
router.post('/mercadopago/webhook', asyncHandler(controlador.webhook));

router.post('/:id/sync', authenticate, cobranza, validate(idParamSchema, 'params'), asyncHandler(controlador.sync));
router.post('/:id/cancel', authenticate, cobranza, validate(idParamSchema, 'params'), asyncHandler(controlador.cancel));

export default router;
