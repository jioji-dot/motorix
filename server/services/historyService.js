// Consulta del historial de servicios de un vehículo (US1). Es de solo lectura para todos los roles.
import * as historyModel from '../models/historyModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { normalizePagination } from '../utils/normalizers.js';

export async function getVehicleHistory(vehicleId, { page, pageSize }) {
  if (!(await vehicleModel.findById(vehicleId))) throw errors.notFound('El vehículo no existe.');

  const paginacion = normalizePagination({ page, pageSize });
  const [items, total] = await Promise.all([
    historyModel.listHistory(vehicleId, { limit: paginacion.pageSize, offset: paginacion.offset }),
    historyModel.countHistory(vehicleId)
  ]);
  return { items, total, page: paginacion.page, pageSize: paginacion.pageSize };
}
