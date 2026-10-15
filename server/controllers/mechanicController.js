import * as userModel from '../models/userModel.js';
import { ok } from '../utils/response.js';

/** Mecánicos activos para asignar órdenes (sin exponer la gestión de usuarios). */
export async function list(req, res, next) {
  try {
    ok(res, await userModel.listActiveMechanics());
  } catch (error) {
    next(error);
  }
}
