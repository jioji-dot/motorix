import * as orderService from '../services/orderService.js';
import { ok, okList } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const { items, total, page, pageSize } = await orderService.listOrders(req.user, req.valid.query);
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    ok(res, await orderService.createOrder(req.user, req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function updateBasics(req, res, next) {
  try {
    ok(res, await orderService.updateOrderBasics(req.user, req.valid.params.id, req.valid.body));
  } catch (error) {
    next(error);
  }
}

export async function changeStatus(req, res, next) {
  try {
    ok(
      res,
      await orderService.changeOrderStatus(req.user, req.valid.params.id, req.valid.body.status)
    );
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    ok(res, await orderService.getOrder(req.user, req.valid.params.id));
  } catch (error) {
    next(error);
  }
}
