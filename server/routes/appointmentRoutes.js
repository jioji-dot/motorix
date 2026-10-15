import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as appointmentController from '../controllers/appointmentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import {
  createAppointmentBody,
  listAppointmentsQuery,
  updateAppointmentBody
} from '../validators/appointmentValidators.js';
import { idParams } from '../validators/common.js';

const router = Router();

// Las citas son exclusivas de recepción y administración (validado en el servidor).
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST));

router.get('/', validate({ query: listAppointmentsQuery }), appointmentController.list);
router.post('/', validate({ body: createAppointmentBody }), appointmentController.create);
router.get('/:id', validate({ params: idParams }), appointmentController.getById);
router.patch(
  '/:id',
  validate({ params: idParams, body: updateAppointmentBody }),
  appointmentController.update
);
router.post('/:id/confirm', validate({ params: idParams }), appointmentController.confirm);
router.post('/:id/cancel', validate({ params: idParams }), appointmentController.cancel);

export default router;
