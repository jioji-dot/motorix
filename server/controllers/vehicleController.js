import * as vehicleService from '../services/vehicleService.js';
import { ok, okList } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const { items, total, page, pageSize } = await vehicleService.listVehicles(req.valid.query);
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    ok(res, await vehicleService.createVehicle(req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    ok(res, await vehicleService.getVehicleById(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await vehicleService.updateVehicle(req.valid.params.id, req.valid.body));
  } catch (error) {
    next(error);
  }
}
