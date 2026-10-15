import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as userController from '../controllers/userController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import {
  createUserBody,
  listUsersQuery,
  resetPasswordBody,
  updateUserBody
} from '../validators/userValidators.js';

const router = Router();

// Toda la gestión de usuarios es exclusiva del administrador (validado en el servidor).
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', validate({ query: listUsersQuery }), userController.list);
router.post('/', validate({ body: createUserBody }), userController.create);
router.get('/:id', validate({ params: idParams }), userController.getById);
router.patch('/:id', validate({ params: idParams, body: updateUserBody }), userController.update);
router.post(
  '/:id/reset-password',
  validate({ params: idParams, body: resetPasswordBody }),
  userController.resetPassword
);

export default router;
