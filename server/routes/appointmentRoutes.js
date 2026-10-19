import { Router } from 'express';
import * as controlador from '../controllers/appointmentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  appointmentListQuerySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from '../validators/appointmentValidator.js';
import { idParamSchema } from '../validators/commonValidator.js';

const router = Router();

// La agenda es de recepción y administración; el mecánico no la usa.
router.use(authenticate, authorize('ADMIN', 'RECEPTIONIST'));

router.get('/', validate(appointmentListQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controlador.get));
router.post('/', validate(createAppointmentSchema), asyncHandler(controlador.create));
router.patch('/:id', validate(idParamSchema, 'params'), validate(updateAppointmentSchema), asyncHandler(controlador.update));
router.post('/:id/confirm', validate(idParamSchema, 'params'), asyncHandler(controlador.confirm));
router.post('/:id/cancel', validate(idParamSchema, 'params'), asyncHandler(controlador.cancel));

export default router;
