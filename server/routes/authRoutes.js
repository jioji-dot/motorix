import { Router } from 'express';
import * as controlador from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { changePasswordSchema, loginSchema } from '../validators/authValidator.js';

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(controlador.login));
router.get('/me', authenticate, controlador.me);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(controlador.changePassword),
);

export default router;
