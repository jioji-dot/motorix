import { Router } from 'express';
import * as controlador from '../controllers/clientController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createClientSchema, updateClientSchema } from '../validators/clientValidator.js';
import { idParamSchema, listQuerySchema } from '../validators/commonValidator.js';

const router = Router();
const lectura = authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC');
const escritura = authorize('ADMIN', 'RECEPTIONIST');

router.use(authenticate);

router.get('/', lectura, validate(listQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', lectura, validate(idParamSchema, 'params'), asyncHandler(controlador.get));
router.post('/', escritura, validate(createClientSchema), asyncHandler(controlador.create));
router.patch(
  '/:id',
  escritura,
  validate(idParamSchema, 'params'),
  validate(updateClientSchema),
  asyncHandler(controlador.update),
);

export default router;
