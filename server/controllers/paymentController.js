import * as paymentService from '../services/paymentService.js';
import { ok, okList } from '../utils/response.js';

const manejar = (fn, status = 200) => async (req, res, next) => {
  try {
    ok(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

export const orderPayments = manejar((req) => paymentService.getOrderPayments(req.user, req.valid.params.id));

export const register = manejar(
  (req) => paymentService.registerPayment(req.user, req.valid.params.id, req.valid.body),
  201
);

export const createMercadoPago = manejar(
  (req) => paymentService.createMercadoPagoCharge(req.user, req.valid.params.id, req.valid.body),
  201
);

export const refresh = manejar((req) => paymentService.refreshPayment(req.user, req.valid.params.id));

export async function list(req, res, next) {
  try {
    const { items, total, approvedTotal, page, pageSize } = await paymentService.listPayments(
      req.user,
      req.valid.query
    );
    res.status(200).json({ data: items, meta: { page, pageSize, total, approvedTotal } });
  } catch (error) {
    next(error);
  }
}

export const getById = manejar((req) => paymentService.getPayment(req.user, req.valid.params.id));
export const cancel = manejar((req) => paymentService.cancelPayment(req.user, req.valid.params.id));
export const voidPayment = manejar((req) =>
  paymentService.voidPayment(req.user, req.valid.params.id, req.valid.body)
);
