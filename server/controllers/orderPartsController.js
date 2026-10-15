import * as orderParts from '../services/orderPartsService.js';
import { ok } from '../utils/response.js';

// Cada controlador delega en el servicio y responde con el detalle actualizado de la orden.
const manejar = (fn) => async (req, res, next) => {
  try {
    ok(res, await fn(req));
  } catch (error) {
    next(error);
  }
};

export const addPart = manejar((req) =>
  orderParts.addPart(req.user, req.valid.params.id, req.valid.body)
);
export const updatePart = manejar((req) =>
  orderParts.updatePartQuantity(
    req.user,
    req.valid.params.id,
    req.valid.params.orderPartId,
    req.valid.body
  )
);
export const removePart = manejar((req) =>
  orderParts.removePart(req.user, req.valid.params.id, req.valid.params.orderPartId)
);
