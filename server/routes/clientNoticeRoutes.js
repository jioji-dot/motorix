import { Router } from 'express';
import * as controlador from '../controllers/clientNoticeController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clientNoticeListQuerySchema, createClientNoticeSchema } from '../validators/notificationValidator.js';

const router = Router();

// El mecánico no accede: la lista incluye teléfonos de clientes.
router.use(authenticate, authorize('ADMIN', 'RECEPTIONIST'));

router.get('/', validate(clientNoticeListQuerySchema, 'query'), asyncHandler(controlador.list));
router.post('/', validate(createClientNoticeSchema), asyncHandler(controlador.create));

export default router;
