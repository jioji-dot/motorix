import { Router } from 'express';
import { ROLES } from '../config/constants.js';
import * as clientController from '../controllers/clientController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import {
  createClientBody,
  listClientsQuery,
  updateClientBody
} from '../validators/clientValidators.js';

const router = Router();
const puedeEscribir = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.use(authenticate);

router.get('/', validate({ query: listClientsQuery }), clientController.list);
router.post('/', puedeEscribir, validate({ body: createClientBody }), clientController.create);
router.get('/:id', validate({ params: idParams }), clientController.getById);
router.patch(
  '/:id',
  puedeEscribir,
  validate({ params: idParams, body: updateClientBody }),
  clientController.update
);

export default router;
