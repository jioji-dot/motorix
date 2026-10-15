import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { listPaymentsQuery, voidPaymentBody } from '../validators/paymentValidators.js';

const router = Router();

router.use(authenticate);

// Los pagos son de administración y recepción; el mecánico no accede a ninguno.
const recepcionYAdmin = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.get('/', recepcionYAdmin, validate({ query: listPaymentsQuery }), paymentController.list);
router.get('/:id', recepcionYAdmin, validate({ params: idParams }), paymentController.getById);
router.post('/:id/refresh', recepcionYAdmin, validate({ params: idParams }), paymentController.refresh);
router.post('/:id/cancel', recepcionYAdmin, validate({ params: idParams }), paymentController.cancel);
// Anular un pago aprobado solo lo hace la administración y exige un motivo.
router.post(
  '/:id/void',
  authorize(ROLES.ADMIN),
  validate({ params: idParams, body: voidPaymentBody }),
  paymentController.voidPayment
);

export default router;
