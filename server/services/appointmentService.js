// Lógica de negocio de citas.
import * as modeloCitas from '../models/appointmentModel.js';
import * as modeloClientes from '../models/clientModel.js';
import * as modeloVehiculos from '../models/vehicleModel.js';
import { APPOINTMENT_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';

const EDITABLES = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED];

function noEditable(cita, accion) {
  return new HttpError(
    409,
    'APPOINTMENT_NOT_EDITABLE',
    `No se puede ${accion} una cita en estado ${cita.status}. Solo las citas Pendientes o Confirmadas lo permiten.`,
  );
}

export function createAppointmentService({
  appointmentModel = modeloCitas,
  clientModel = modeloClientes,
  vehicleModel = modeloVehiculos,
  now = () => new Date(),
} = {}) {
  // La hora actual se trunca al minuto: una cita para el minuto en curso todavía es válida.
  function verificarNoPasada(fecha) {
    const inicioDelMinuto = new Date(now());
    inicioDelMinuto.setSeconds(0, 0);
    if (fecha < inicioDelMinuto) {
      throw HttpError.validation('Revisa los datos enviados.', [
        { field: 'scheduledAt', message: 'La fecha y hora de la cita no pueden estar en el pasado.' },
      ]);
    }
  }

  async function verificarDuplicada(vehicleId, fecha, confirmada, excluirId = null) {
    if (confirmada) return;
    const existente = await appointmentModel.findDuplicate(vehicleId, fecha, excluirId);
    if (existente) {
      throw new HttpError(
        409,
        'DUPLICATE_APPOINTMENT',
        'Ya hay una cita activa de este vehículo a esa fecha y hora. Confirma si quieres registrarla de todos modos.',
        [{ id: existente.id, scheduledAt: existente.scheduledAt, status: existente.status }],
      );
    }
  }

  async function obtener(id) {
    const cita = await appointmentModel.findById(id);
    if (!cita) throw HttpError.notFound('No se encontró la cita solicitada.');
    return cita;
  }

  async function list(filtros) {
    const { items, total } = await appointmentModel.list(filtros);
    return { items, meta: { page: filtros.page, pageSize: filtros.pageSize, total } };
  }

  async function create({ confirmDuplicate, ...datos }, usuario) {
    const cliente = await clientModel.findById(datos.clientId);
    if (!cliente) throw HttpError.notFound('El cliente indicado no existe.');
    if (!cliente.active) {
      throw HttpError.validation('Revisa los datos enviados.', [
        { field: 'clientId', message: 'El cliente está desactivado y no admite citas nuevas.' },
      ]);
    }
    const vehiculo = await vehicleModel.findById(datos.vehicleId);
    if (!vehiculo) throw HttpError.notFound('El vehículo indicado no existe.');
    if (vehiculo.clientId !== datos.clientId) {
      throw HttpError.validation('Revisa los datos enviados.', [
        { field: 'vehicleId', message: 'El vehículo no pertenece al cliente seleccionado.' },
      ]);
    }

    verificarNoPasada(datos.scheduledAt);
    await verificarDuplicada(datos.vehicleId, datos.scheduledAt, confirmDuplicate);
    return appointmentModel.create({ ...datos, createdBy: usuario.id });
  }

  async function update(id, { confirmDuplicate, ...datos }) {
    const cita = await obtener(id);
    if (!EDITABLES.includes(cita.status)) throw noEditable(cita, 'modificar');

    const cambiaFecha =
      datos.scheduledAt !== undefined && datos.scheduledAt.getTime() !== new Date(cita.scheduledAt).getTime();
    if (cambiaFecha) {
      verificarNoPasada(datos.scheduledAt);
      await verificarDuplicada(cita.vehicleId, datos.scheduledAt, confirmDuplicate, id);
    }
    return appointmentModel.update(id, datos);
  }

  async function confirm(id) {
    const cita = await obtener(id);
    if (cita.status !== APPOINTMENT_STATUS.PENDING) throw noEditable(cita, 'confirmar');
    return appointmentModel.setStatus(id, APPOINTMENT_STATUS.CONFIRMED);
  }

  // Una cita con orden activa no se cancela: primero se cancela la orden (sin cancelaciones en cascada).
  async function cancel(id) {
    const cita = await obtener(id);
    if (await appointmentModel.hasActiveOrder(id)) {
      throw new HttpError(
        409,
        'APPOINTMENT_HAS_ORDER',
        'Esta cita ya tiene una orden de servicio activa. Cancela primero la orden para poder cancelar la cita.',
      );
    }
    if (!EDITABLES.includes(cita.status)) throw noEditable(cita, 'cancelar');
    return appointmentModel.setStatus(id, APPOINTMENT_STATUS.CANCELLED);
  }

  return { list, get: obtener, create, update, confirm, cancel };
}

export const appointmentService = createAppointmentService();
