import { Router } from 'express';
import * as controlador from '../controllers/reportController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { reportNameParamSchema, reportRangeSchema } from '../validators/reportValidator.js';

const router = Router();

// Descarga del CSV: pública, protegida por el enlace firmado de 60 segundos (el navegador no envía la sesión).
router.get('/export/:token', asyncHandler(controlador.download));

// Los reportes y su enlace de exportación son exclusivos del administrador (validado en el servidor).
router.use(authenticate, authorize('ADMIN'));

for (const nombre of ['income', 'services', 'productivity', 'parts', 'rotation']) {
  router.get(`/${nombre}`, validate(reportRangeSchema, 'query'), asyncHandler(controlador[nombre]));
}
router.get('/:name/export-link', validate(reportNameParamSchema, 'params'), validate(reportRangeSchema, 'query'), controlador.exportLink);

export default router;
