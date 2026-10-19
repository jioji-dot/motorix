import { Router } from 'express';
import * as controlador from '../controllers/ticketController.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { printTokenParamSchema } from '../validators/paymentValidator.js';

const router = Router();

// Página imprimible: el navegador no envía encabezados de sesión, así que se protege con un token de 5 minutos.
router.get('/print/:token', validate(printTokenParamSchema, 'params'), asyncHandler(controlador.printPage));

export default router;
