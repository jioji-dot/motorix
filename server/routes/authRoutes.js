import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { changePasswordBody, loginBody } from '../validators/authValidators.js';

const router = Router();

router.post('/login', validate({ body: loginBody }), authController.login);
router.get('/me', authenticate, authController.me);
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordBody }),
  authController.changePassword
);

export default router;
