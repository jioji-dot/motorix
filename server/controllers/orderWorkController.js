import * as work from '../services/orderWorkService.js';
import { ok } from '../utils/response.js';

// Cada controlador delega en el servicio y responde con el detalle actualizado de la orden.
const manejar = (fn, status = 200) => async (req, res, next) => {
  try {
    ok(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

export const updateWork = manejar((req) => work.updateWork(req.user, req.valid.params.id, req.valid.body));

export const addService = manejar(
  (req) => work.addService(req.user, req.valid.params.id, req.valid.body),
  201
);
export const updateService = manejar((req) =>
  work.updateService(req.user, req.valid.params.id, req.valid.params.serviceId, req.valid.body)
);
export const removeService = manejar((req) =>
  work.removeService(req.user, req.valid.params.id, req.valid.params.serviceId)
);

export const addLabor = manejar(
  (req) => work.addLabor(req.user, req.valid.params.id, req.valid.body),
  201
);
export const updateLabor = manejar((req) =>
  work.updateLabor(req.user, req.valid.params.id, req.valid.params.laborId, req.valid.body)
);
export const removeLabor = manejar((req) =>
  work.removeLabor(req.user, req.valid.params.id, req.valid.params.laborId)
);
