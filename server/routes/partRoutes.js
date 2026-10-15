import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as partController from '../controllers/partController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import {
  adjustmentBody,
  availablePartsQuery,
  createPartBody,
  entryBody,
  listPartsQuery,
  movementsQuery,
  updatePartBody
} from '../validators/partValidators.js';

const router = Router();

router.use(authenticate);

const soloAdmin = authorize(ROLES.ADMIN);

// Las rutas estáticas (/available, y /alerts en US8) se declaran antes de "/:id".
// El mecánico solo busca refacciones activas con existencia para agregarlas a sus órdenes.
// Resumen de alertas de existencia (stock bajo y agotadas): solo administración.
router.get('/alerts', soloAdmin, partController.alerts);
router.get(
  '/available',
  authorize(ROLES.ADMIN, ROLES.MECHANIC),
  validate({ query: availablePartsQuery }),
  partController.available
);

router.get('/', soloAdmin, validate({ query: listPartsQuery }), partController.list);
router.post('/', soloAdmin, validate({ body: createPartBody }), partController.create);
router.get('/:id', soloAdmin, validate({ params: idParams }), partController.getById);
router.patch(
  '/:id',
  soloAdmin,
  validate({ params: idParams, body: updatePartBody }),
  partController.update
);
router.post('/:id/deactivate', soloAdmin, validate({ params: idParams }), partController.deactivate);
router.post('/:id/activate', soloAdmin, validate({ params: idParams }), partController.activate);
router.post(
  '/:id/entries',
  soloAdmin,
  validate({ params: idParams, body: entryBody }),
  partController.registerEntry
);
router.post(
  '/:id/adjustments',
  soloAdmin,
  validate({ params: idParams, body: adjustmentBody }),
  partController.registerAdjustment
);
router.get(
  '/:id/movements',
  soloAdmin,
  validate({ params: idParams, query: movementsQuery }),
  partController.listMovements
);

export default router;
