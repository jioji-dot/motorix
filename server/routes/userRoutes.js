import { Router } from 'express';
import * as controlador from '../controllers/userController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/commonValidator.js';
import { createUserSchema, updateUserSchema, userListQuerySchema } from '../validators/userValidator.js';

const router = Router();

// Solo el administrador gestiona usuarios y roles.
router.use(authenticate, authorize('ADMIN'));

router.get('/', validate(userListQuerySchema, 'query'), asyncHandler(controlador.list));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controlador.get));
router.post('/', validate(createUserSchema), asyncHandler(controlador.create));
router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(controlador.update),
);

export default router;
