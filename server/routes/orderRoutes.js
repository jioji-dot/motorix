import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as orderController from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import * as work from '../controllers/orderWorkController.js';
import * as orderParts from '../controllers/orderPartsController.js';
import * as payments from '../controllers/paymentController.js';
import * as tickets from '../controllers/ticketController.js';
import { mercadoPagoBody, registerPaymentBody } from '../validators/paymentValidators.js';
import {
  addOrderPartBody,
  changeStatusBody,
  createOrderBody,
  laborBody,
  laborParams,
  listOrdersQuery,
  orderPartParams,
  serviceBody,
  serviceParams,
  updateLaborBody,
  updateOrderPartBody,
  updateOrderBasicsBody,
  updateServiceBody,
  updateWorkBody
} from '../validators/orderValidators.js';

const router = Router();

router.use(authenticate);

// Todos los roles consultan; el servicio limita al mecánico a sus órdenes asignadas.
router.get('/', validate({ query: listOrdersQuery }), orderController.list);
router.get('/:id', validate({ params: idParams }), orderController.getById);

router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate({ body: createOrderBody }),
  orderController.create
);

router.patch(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate({ params: idParams, body: updateOrderBasicsBody }),
  orderController.updateBasics
);

// Cambio de estado: el servicio comprueba visibilidad, permiso del rol y reglas de transición.
router.post(
  '/:id/status',
  validate({ params: idParams, body: changeStatusBody }),
  orderController.changeStatus
);

// Trabajo técnico: el servicio comprueba "administrador o mecánico asignado" (403/404).
router.patch('/:id/work', validate({ params: idParams, body: updateWorkBody }), work.updateWork);

router.post('/:id/services', validate({ params: idParams, body: serviceBody }), work.addService);
router.patch(
  '/:id/services/:serviceId',
  validate({ params: serviceParams, body: updateServiceBody }),
  work.updateService
);
router.delete('/:id/services/:serviceId', validate({ params: serviceParams }), work.removeService);

router.post('/:id/labor', validate({ params: idParams, body: laborBody }), work.addLabor);
router.patch(
  '/:id/labor/:laborId',
  validate({ params: laborParams, body: updateLaborBody }),
  work.updateLabor
);
router.delete('/:id/labor/:laborId', validate({ params: laborParams }), work.removeLabor);

// Refacciones usadas: cada cambio genera su movimiento de inventario (administrador o mecánico asignado).
router.post('/:id/parts', validate({ params: idParams, body: addOrderPartBody }), orderParts.addPart);
router.patch(
  '/:id/parts/:orderPartId',
  validate({ params: orderPartParams, body: updateOrderPartBody }),
  orderParts.updatePart
);
router.delete(
  '/:id/parts/:orderPartId',
  validate({ params: orderPartParams }),
  orderParts.removePart
);

// Pagos de la orden: administración y recepción (el mecánico no accede).
const recepcionYAdmin = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);
router.get('/:id/payments', recepcionYAdmin, validate({ params: idParams }), payments.orderPayments);
router.post(
  '/:id/payments',
  recepcionYAdmin,
  validate({ params: idParams, body: registerPaymentBody }),
  payments.register
);

// Cobro digital: crea un cobro pendiente de Mercado Pago y devuelve su enlace de pago.
router.post(
  '/:id/payments/mercado-pago',
  recepcionYAdmin,
  validate({ params: idParams, body: mercadoPagoBody }),
  payments.createMercadoPago
);

// Ticket de la orden (uno por orden): se genera o se devuelve el existente.
router.post('/:id/ticket', recepcionYAdmin, validate({ params: idParams }), tickets.generate);

export default router;
