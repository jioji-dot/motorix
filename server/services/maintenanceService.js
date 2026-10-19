// Lógica de negocio de los mantenimientos programados.
import { withTransaction } from '../config/db.js';
import * as modeloMantenimientos from '../models/maintenanceModel.js';
import * as modeloVehiculos from '../models/vehicleModel.js';
import { MAINTENANCE_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { reglasDeMantenimiento } from '../validators/maintenanceValidator.js';
import { classify, compareByUrgency, hoyLocal } from './maintenanceClassifier.js';

export function createMaintenanceService({
  maintenanceModel = modeloMantenimientos,
  vehicleModel = modeloVehiculos,
  transaction = withTransaction,
  hoy = hoyLocal,
} = {}) {
  // La clasificación se calcula siempre con el kilometraje actual del vehículo y la fecha de hoy.
  function conClasificacion(mantenimiento) {
    if (mantenimiento.status !== MAINTENANCE_STATUS.PENDING) {
      return { ...mantenimiento, classification: null, daysLeft: null, kmLeft: null };
    }
    return { ...mantenimiento, ...classify(mantenimiento, mantenimiento.vehicle.currentMileage, hoy()) };
  }

  function validarReglas(datos) {
    const problemas = reglasDeMantenimiento(datos);
    if (problemas.length > 0) throw HttpError.validation('Revisa los datos enviados.', problemas);
  }

  async function create(datos, usuario) {
    const vehiculo = await vehicleModel.findById(datos.vehicleId);
    if (!vehiculo) throw HttpError.notFound('El vehículo indicado no existe.');
    if (datos.sourceOrderId !== undefined && !(await maintenanceModel.orderExists(datos.sourceOrderId))) {
      throw HttpError.notFound('La orden de origen indicada no existe.');
    }
    const id = await transaction((conexion) =>
      maintenanceModel.createReplacing(conexion, { ...datos, createdBy: usuario.id }),
    );
    return conClasificacion(await maintenanceModel.findById(id));
  }

  async function get(id) {
    const mantenimiento = await maintenanceModel.findById(id);
    if (!mantenimiento) throw HttpError.notFound('No se encontró el mantenimiento solicitado.');
    return conClasificacion(mantenimiento);
  }

  async function update(id, datos) {
    await transaction(async (conexion) => {
      const actual = await maintenanceModel.lock(conexion, id);
      if (!actual) throw HttpError.notFound('No se encontró el mantenimiento solicitado.');
      if (actual.status !== MAINTENANCE_STATUS.PENDING) {
        throw new HttpError(409, 'MAINTENANCE_NOT_EDITABLE', 'Un mantenimiento Atendido ya no se puede editar.');
      }
      // Las reglas cruzadas se comprueban con el resultado final (valores guardados más los cambios).
      validarReglas({ ...actual, ...datos });
      await maintenanceModel.update(conexion, id, datos);
    });
    return get(id);
  }

  async function list({ classification, status, vehicleId, clientId, search, page, pageSize }) {
    const todos = (await maintenanceModel.listAll({ status, vehicleId, clientId, search })).map(conClasificacion);
    const filtrados = classification ? todos.filter((m) => classification.includes(m.classification)) : todos;
    // Los atendidos (sin clasificación) van al final, del más reciente al más antiguo.
    const pendientes = filtrados.filter((m) => m.classification !== null).sort(compareByUrgency);
    const atendidos = filtrados.filter((m) => m.classification === null).sort((a, b) => b.id - a.id);
    const ordenados = [...pendientes, ...atendidos];
    const inicio = (page - 1) * pageSize;
    return { items: ordenados.slice(inicio, inicio + pageSize), meta: { page, pageSize, total: ordenados.length } };
  }

  return { create, get, update, list };
}

export const maintenanceService = createMaintenanceService();
