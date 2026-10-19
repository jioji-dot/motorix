import { Router } from 'express';
import * as controlador from '../controllers/partController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { historyQuerySchema, idParamSchema } from '../validators/commonValidator.js';
import { createPartSchema, movementSchema, partListQuerySchema, updatePartSchema } from '../validators/partValidator.js';

const router = Router();
const lectura = authorize('ADMIN', 'RECEPTIONIST', 'MECHANIC');
const escritura = authorize('ADMIN');

router.use(authenticate);

// El resumen y las categorías van antes de "/:id" para que no se tomen como un identificador.
router.get('/summary', lectura, asyncHandler(controlador.summary));
router.get('/categories', lectura, asyncHandler(controlador.categories));
router.get('/', lectura, validate(partListQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', lectura, validate(idParamSchema, 'params'), asyncHandler(controlador.get));
router.post('/', escritura, validate(createPartSchema), asyncHandler(controlador.create));
router.patch('/:id', escritura, validate(idParamSchema, 'params'), validate(updatePartSchema), asyncHandler(controlador.update));
router.get(
  '/:id/movements',
  lectura,
  validate(idParamSchema, 'params'),
  validate(historyQuerySchema, 'query'),
  asyncHandler(controlador.listMovements),
);
router.post(
  '/:id/movements',
  escritura,
  validate(idParamSchema, 'params'),
  validate(movementSchema),
  asyncHandler(controlador.registerMovement),
);

export default router;
