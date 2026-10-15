import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as ticketController from '../controllers/ticketController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { listTicketsQuery } from '../validators/ticketValidators.js';

const router = Router();

router.use(authenticate);

// Los tickets son de administración y recepción; el mecánico no accede.
router.use(authorize(ROLES.ADMIN, ROLES.RECEPTIONIST));

router.get('/', validate({ query: listTicketsQuery }), ticketController.list);
router.get('/:id', validate({ params: idParams }), ticketController.getById);

export default router;
