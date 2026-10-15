// Reglas de negocio de las citas.
import * as appointmentModel from '../models/appointmentModel.js';
import * as clientModel from '../models/clientModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { parseLocalDateTime } from '../utils/localDateTime.js';
import { normalizePagination } from '../utils/normalizers.js';

/** Aviso (confirmable) si el vehículo ya tiene otra cita no cancelada el mismo día (FR-007). */
async function verificarCoincidencias(vehicleId, scheduledAt, confirmado, excluirId = null) {
  if (confirmado) return;
  const coincidencias = await appointmentModel.findSameDayByVehicle(
    vehicleId,
    scheduledAt.slice(0, 10),
    excluirId
  );
  if (coincidencias.length > 0) throw errors.appointmentDuplicateWarning(coincidencias);
}

/** Registra una cita en estado PENDIENTE. */
export async function createAppointment(user, datos) {
  const cliente = await clientModel.findById(datos.clientId);
  if (!cliente) throw errors.notFound('El cliente no existe.', { field: 'clientId' });

  const vehiculo = await vehicleModel.findById(datos.vehicleId);
  if (!vehiculo) throw errors.notFound('El vehículo no existe.', { field: 'vehicleId' });

  if (vehiculo.clientId !== cliente.id) {
    throw errors.validation('El vehículo no pertenece al cliente indicado.', [
      { field: 'vehicleId', message: 'El vehículo no pertenece al cliente indicado.' }
    ]);
  }

  await verificarCoincidencias(vehiculo.id, datos.scheduledAt, datos.confirmDuplicate === true);

  const id = await appointmentModel.insert({
    clientId: cliente.id,
    vehicleId: vehiculo.id,
    scheduledAtSql: parseLocalDateTime(datos.scheduledAt).sql,
    reason: datos.reason,
    notes: datos.notes ?? null,
    createdBy: user.id
  });
  return appointmentModel.findById(id);
}

export async function listAppointments(filtros) {
  const paginacion = normalizePagination(filtros);
  const { rows, total } = await appointmentModel.list({
    ...filtros,
    search: filtros.search || undefined,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return { items: rows, total, page: paginacion.page, pageSize: paginacion.pageSize };
}

export async function getAppointment(id) {
  const cita = await appointmentModel.findById(id);
  if (!cita) throw errors.notFound('La cita no existe.');
  return cita;
}

/** Solo las citas PENDIENTE o CONFIRMADA, y sin orden, se pueden modificar o cancelar. */
const ESTADOS_ABIERTOS = ['PENDIENTE', 'CONFIRMADA'];

async function getOpenAppointment(id) {
  const cita = await getAppointment(id);
  if (cita.orderId !== null || !ESTADOS_ABIERTOS.includes(cita.status)) {
    throw errors.appointmentNotEditable();
  }
  return cita;
}

/** Modifica fecha, hora, motivo y observaciones; el cliente y el vehículo no cambian. */
export async function updateAppointment(id, datos) {
  const cita = await getOpenAppointment(id);

  if (datos.scheduledAt !== undefined && datos.scheduledAt !== cita.scheduledAt) {
    await verificarCoincidencias(cita.vehicleId, datos.scheduledAt, datos.confirmDuplicate === true, id);
  }

  await appointmentModel.update(id, {
    scheduledAtSql: datos.scheduledAt === undefined ? undefined : parseLocalDateTime(datos.scheduledAt).sql,
    reason: datos.reason,
    notes: datos.notes
  });
  return appointmentModel.findById(id);
}

/** PENDIENTE → CONFIRMADA. */
export async function confirmAppointment(id) {
  const cita = await getAppointment(id);
  if (cita.status !== 'PENDIENTE' || !(await appointmentModel.setStatus(id, ['PENDIENTE'], 'CONFIRMADA'))) {
    throw errors.appointmentNotEditable();
  }
  return appointmentModel.findById(id);
}

/** PENDIENTE o CONFIRMADA → CANCELADA, solo sin orden. La cita se conserva como historial. */
export async function cancelAppointment(id) {
  const cita = await getAppointment(id);
  if (cita.orderId !== null) throw errors.appointmentHasOrder();
  if (!ESTADOS_ABIERTOS.includes(cita.status)) throw errors.appointmentNotEditable();

  if (!(await appointmentModel.setStatus(id, ESTADOS_ABIERTOS, 'CANCELADA'))) {
    // Otra operación cambió la cita entretanto (por ejemplo, se creó su orden).
    const vigente = await appointmentModel.findById(id);
    throw vigente.orderId !== null ? errors.appointmentHasOrder() : errors.appointmentNotEditable();
  }
  return appointmentModel.findById(id);
}
