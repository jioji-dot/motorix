// Reglas de negocio de vehículos.
import * as clientModel from '../models/clientModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { validateEntryMileage } from './mileageService.js';
import { normalizePagination } from '../utils/normalizers.js';

/** Registra un vehículo. Nunca existe un vehículo sin propietario (RN-1, FR-016). */
export async function createVehicle(datos) {
  const propietario = await clientModel.findById(datos.clientId);
  if (!propietario) {
    throw errors.notFound('El propietario indicado no existe.', { field: 'clientId' });
  }

  const id = await vehicleModel.insert({
    clientId: datos.clientId,
    brand: datos.brand,
    model: datos.model,
    year: datos.year,
    licensePlate: datos.licensePlate,
    vin: datos.vin ?? null,
    color: datos.color ?? null,
    currentMileage: datos.currentMileage ?? 0
  });
  return vehicleModel.findByIdWithOwner(id);
}

export async function listVehicles({ search, clientId, page, pageSize }) {
  const paginacion = normalizePagination({ page, pageSize });
  const { rows, total } = await vehicleModel.list({
    search: search || undefined,
    clientId,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return { items: rows, total, page: paginacion.page, pageSize: paginacion.pageSize };
}

export async function getVehicleById(id) {
  const vehiculo = await vehicleModel.findByIdWithOwner(id);
  if (!vehiculo) throw errors.notFound('El vehículo no existe.');
  return vehiculo;
}

/**
 * Edita un vehículo. El propietario no cambia y el kilometraje no puede bajar sin una
 * corrección explícita (`mileageCorrection: true`, Principio V).
 */
export async function updateVehicle(id, datos) {
  const existente = await vehicleModel.findById(id);
  if (!existente) throw errors.notFound('El vehículo no existe.');

  const { mileageCorrection, ...campos } = datos;
  if (campos.currentMileage !== undefined) {
    validateEntryMileage({
      currentMileage: existente.currentMileage,
      entryMileage: campos.currentMileage,
      mileageCorrection
    });
  }

  await vehicleModel.update(id, campos);
  return vehicleModel.findByIdWithOwner(id);
}
