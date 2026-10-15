import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.use(authenticate);

// El panel de control es solo para administración.
router.get('/', authorize(ROLES.ADMIN), dashboardController.get);

export default router;
