// Lógica de negocio de vehículos.
import * as modeloClientes from '../models/clientModel.js';
import * as modeloVehiculos from '../models/vehicleModel.js';
import { HttpError } from '../utils/httpError.js';

const MENSAJE_PLACAS = 'Ya existe un vehículo con esas placas.';
const MENSAJE_VIN = 'Ya existe un vehículo con ese número de serie.';

function duplicado(campo, mensaje) {
  return HttpError.duplicate(mensaje, [{ field: campo, message: mensaje }]);
}

// Traduce un choque de la restricción UNIQUE (carrera entre dos altas) al mismo error de negocio.
function traducirDuplicadoDeBase(error) {
  if (error?.code !== 'ER_DUP_ENTRY') return error;
  if (String(error.sqlMessage).includes('uq_vehicles_vin')) return duplicado('vin', MENSAJE_VIN);
  return duplicado('licensePlate', MENSAJE_PLACAS);
}

export function createVehicleService({ vehicleModel = modeloVehiculos, clientModel = modeloClientes } = {}) {
  async function verificarUnicos({ licensePlate, vin }, excluirId = null) {
    if (licensePlate !== undefined && (await vehicleModel.findByLicensePlate(licensePlate, excluirId))) {
      throw duplicado('licensePlate', MENSAJE_PLACAS);
    }
    // Varios vehículos pueden no tener número de serie: solo se compara cuando se captura.
    if (vin && (await vehicleModel.findByVin(vin, excluirId))) {
      throw duplicado('vin', MENSAJE_VIN);
    }
  }

  async function list(filtros) {
    const { items, total } = await vehicleModel.list(filtros);
    return { items, meta: { page: filtros.page, pageSize: filtros.pageSize, total } };
  }

  async function get(id) {
    const vehiculo = await vehicleModel.findById(id);
    if (!vehiculo) throw HttpError.notFound('No se encontró el vehículo solicitado.');
    return vehiculo;
  }

  // Un vehículo siempre pertenece a un cliente existente (RN-1, FR-021).
  async function create(datos) {
    const propietario = await clientModel.findById(datos.clientId);
    if (!propietario) throw HttpError.notFound('El propietario indicado no existe.');

    await verificarUnicos(datos);
    try {
      return await vehicleModel.create(datos);
    } catch (error) {
      throw traducirDuplicadoDeBase(error);
    }
  }

  async function update(id, { mileageCorrection, ...datos }) {
    const actual = await vehicleModel.findById(id);
    if (!actual) throw HttpError.notFound('No se encontró el vehículo solicitado.');

    // El kilometraje no baja sin una corrección explícita (FR-024, RN-4).
    if (datos.currentMileage !== undefined && datos.currentMileage < actual.currentMileage && !mileageCorrection) {
      throw new HttpError(
        409,
        'MILEAGE_DECREASE',
        `El kilometraje no puede ser menor al registrado (${actual.currentMileage} km). Confirma la corrección si es un error.`,
      );
    }

    await verificarUnicos(datos, id);
    try {
      return await vehicleModel.update(id, datos);
    } catch (error) {
      throw traducirDuplicadoDeBase(error);
    }
  }

  return { list, get, create, update };
}

export const vehicleService = createVehicleService();
