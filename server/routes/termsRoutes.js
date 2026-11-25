import { Router } from 'express';
import * as controlador from '../controllers/termsController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publishTermsSchema } from '../validators/termsValidator.js';

const router = Router();

router.use(authenticate);

// Cualquier usuario autenticado puede ver la versión vigente y aceptarla; publicar y ver quién aceptó es del administrador.
router.get('/current', asyncHandler(controlador.current));
router.post('/accept', asyncHandler(controlador.accept));
router.get('/acceptances', authorize('ADMIN'), asyncHandler(controlador.acceptances));
router.post('/', authorize('ADMIN'), validate(publishTermsSchema), asyncHandler(controlador.publish));

export default router;
