import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as mechanicController from '../controllers/mechanicController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST), mechanicController.list);

export default router;
