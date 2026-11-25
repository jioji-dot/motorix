import { Router } from 'express';
import * as controlador from '../controllers/reportController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { reportRangeSchema } from '../validators/reportValidator.js';

const router = Router();

// Los reportes son exclusivos del administrador (validado en el servidor).
router.use(authenticate, authorize('ADMIN'));

for (const nombre of ['income', 'services', 'productivity', 'parts', 'rotation']) {
  router.get(`/${nombre}`, validate(reportRangeSchema, 'query'), asyncHandler(controlador[nombre]));
}

export default router;
