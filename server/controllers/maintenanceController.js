import * as maintenanceService from '../services/maintenanceService.js';
import { ok } from '../utils/response.js';

const manejar = (fn, status = 200) => async (req, res, next) => {
  try {
    ok(res, await fn(req), status);
  } catch (error) {
    next(error);
  }
};

export async function list(req, res, next) {
  try {
    const { items, meta } = await maintenanceService.listMaintenance(req.user, req.valid.query);
    res.status(200).json({ data: items, meta });
  } catch (error) {
    next(error);
  }
}

export const create = manejar((req) => maintenanceService.createMaintenance(req.user, req.valid.body), 201);
export const getById = manejar((req) => maintenanceService.getMaintenance(req.user, req.valid.params.id));
export const update = manejar((req) =>
  maintenanceService.updateMaintenance(req.user, req.valid.params.id, req.valid.body)
);
export const complete = manejar((req) => maintenanceService.completeMaintenance(req.user, req.valid.params.id));
export const cancel = manejar((req) => maintenanceService.cancelMaintenance(req.user, req.valid.params.id));
export const listByVehicle = manejar((req) =>
  maintenanceService.listVehicleMaintenance(req.user, req.valid.params.id)
);
