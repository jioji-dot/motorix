// Lógica de negocio de las órdenes de servicio.
import { withTransaction } from '../config/db.js';
import * as modeloCitas from '../models/appointmentModel.js';
import * as modeloClientes from '../models/clientModel.js';
import * as modeloOrdenes from '../models/orderModel.js';
import * as modeloUsuarios from '../models/userModel.js';
import * as modeloVehiculos from '../models/vehicleModel.js';
import { APPOINTMENT_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';

function errorDeCampo(campo, mensaje) {
  return HttpError.validation('Revisa los datos enviados.', [{ field: campo, message: mensaje }]);
}

export function createOrderService({
  orderModel = modeloOrdenes,
  appointmentModel = modeloCitas,
  clientModel = modeloClientes,
  vehicleModel = modeloVehiculos,
  userModel = modeloUsuarios,
  transaction = withTransaction,
} = {}) {
  // Transiciones que el usuario puede aplicar ahora; la máquina de estados las calcula (historia 5).
  function transicionesPermitidas() {
    return [];
  }

  function conPermisos(orden, usuario) {
    return { ...orden, allowedTransitions: transicionesPermitidas(orden, usuario) };
  }

  // Crea la orden, actualiza el kilometraje del vehículo y, si viene de una cita, la pasa a En proceso.
  async function create({ mileageCorrection, appointmentId, ...datos }, usuario) {
    const cliente = await clientModel.findById(datos.clientId);
    if (!cliente) throw HttpError.notFound('El cliente indicado no existe.');
    if (!cliente.active) {
      throw errorDeCampo('clientId', 'El cliente está desactivado y no admite órdenes nuevas.');
    }

    const vehiculo = await vehicleModel.findById(datos.vehicleId);
    if (!vehiculo) throw HttpError.notFound('El vehículo indicado no existe.');
    if (vehiculo.clientId !== datos.clientId) {
      throw errorDeCampo('vehicleId', 'El vehículo no pertenece al cliente seleccionado.');
    }

    const mecanico = await userModel.findById(datos.mechanicId);
    if (!mecanico) throw HttpError.notFound('El mecánico indicado no existe.');
    if (mecanico.role !== 'MECHANIC' || !mecanico.active) {
      throw errorDeCampo('mechanicId', 'El mecánico debe ser un usuario activo con rol de mecánico.');
    }

    let reportedProblem = datos.reportedProblem;
    if (appointmentId !== undefined) {
      const cita = await appointmentModel.findById(appointmentId);
      if (!cita) throw HttpError.notFound('La cita indicada no existe.');
      if (cita.status !== APPOINTMENT_STATUS.CONFIRMED) {
        throw new HttpError(
          409,
          'APPOINTMENT_NOT_EDITABLE',
          'Solo se puede crear una orden desde una cita Confirmada.',
        );
      }
      if (cita.clientId !== datos.clientId || cita.vehicleId !== datos.vehicleId) {
        throw errorDeCampo('appointmentId', 'El cliente y el vehículo deben coincidir con los de la cita.');
      }
      reportedProblem ??= cita.reason;
    }

    // El kilometraje no baja sin una corrección explícita (RN-3, RN-4).
    if (datos.entryMileage < vehiculo.currentMileage && !mileageCorrection) {
      throw new HttpError(
        409,
        'MILEAGE_DECREASE',
        `El kilometraje de entrada no puede ser menor al registrado en el vehículo (${vehiculo.currentMileage} km). Confirma la corrección si es un error.`,
      );
    }

    const id = await transaction(async (conexion) => {
      if (appointmentId !== undefined) {
        // Con la cita bloqueada se vuelve a comprobar que no tenga otra orden activa.
        await orderModel.lockAppointment(conexion, appointmentId);
        if (await appointmentModel.hasActiveOrder(appointmentId, conexion)) {
          throw new HttpError(409, 'APPOINTMENT_ALREADY_HAS_ORDER', 'Esta cita ya tiene una orden de servicio activa.');
        }
      }
      const nuevoId = await orderModel.create(conexion, {
        ...datos,
        reportedProblem,
        appointmentId,
        createdBy: usuario.id,
      });
      await vehicleModel.updateMileage(datos.vehicleId, datos.entryMileage, conexion);
      if (appointmentId !== undefined) {
        await appointmentModel.setStatus(appointmentId, APPOINTMENT_STATUS.IN_PROGRESS, conexion);
      }
      return nuevoId;
    });

    return conPermisos(await orderModel.findDetail(id), usuario);
  }

  async function list(filtros, usuario) {
    // El mecánico solo ve sus órdenes: el servidor ignora cualquier otro `mechanicId` que envíe.
    const consulta = usuario.role === 'MECHANIC' ? { ...filtros, mechanicId: usuario.id } : filtros;
    const { items, total } = await orderModel.list(consulta);
    return { items, meta: { page: filtros.page, pageSize: filtros.pageSize, total } };
  }

  async function get(id, usuario) {
    const orden = await orderModel.findDetail(id);
    if (!orden) throw HttpError.notFound('No se encontró la orden solicitada.');
    if (usuario.role === 'MECHANIC' && orden.mechanicId !== usuario.id) {
      throw HttpError.forbidden('Esta orden está asignada a otro mecánico.');
    }
    return conPermisos(orden, usuario);
  }

  return { create, list, get };
}

export const orderService = createOrderService();
