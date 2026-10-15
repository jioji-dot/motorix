// Trabajo técnico de la orden: diagnóstico, servicios, mano de obra, observaciones y recomendaciones.
// Solo el administrador y el mecánico asignado pueden documentar el trabajo (FR-018, FR-021).
import { ROLES } from '../config/constants.js';
import { withTransaction } from '../config/database.js';
import * as orderModel from '../models/orderModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { canEditWork, isNotesEditable, isWorkEditable } from '../utils/orderStatus.js';
import { buildOrderDetail } from './orderService.js';

/**
 * Carga la orden verificando quién puede trabajarla:
 * - inexistente, o ajena para un mecánico → 404 (sin revelar su existencia);
 * - recepción u otro usuario sin permiso de trabajo → 403.
 */
export async function loadForWork(user, id) {
  const orden = await orderModel.findOrderById(id);
  if (!orden || (user.role === ROLES.MECHANIC && orden.mechanicId !== user.id)) {
    throw errors.notFound('La orden no existe.');
  }
  if (!canEditWork(user, orden)) throw errors.forbidden();
  return orden;
}

const assertWorkEditable = (orden) => {
  if (!isWorkEditable(orden.status)) throw errors.orderNotEditable(orden.status);
};

const refresh = async (user, id) => buildOrderDetail(await orderModel.findOrderById(id), user);

/**
 * Diagnóstico (solo en estados de trabajo), observaciones, recomendaciones y kilometraje de
 * servicio (hasta antes de ENTREGADO). Si algún campo no es editable en el estado actual, no se
 * guarda ninguno. El kilometraje de servicio no puede ser menor al de entrada y, al guardarlo, el
 * del vehículo pasa a ser el mayor entre el actual y el de servicio.
 */
export async function updateWork(user, id, datos) {
  const orden = await loadForWork(user, id);

  if (datos.diagnosis !== undefined) assertWorkEditable(orden);
  const tocaNotas =
    datos.notes !== undefined ||
    datos.recommendations !== undefined ||
    datos.serviceMileage !== undefined;
  if (tocaNotas && !isNotesEditable(orden.status)) throw errors.orderNotEditable(orden.status);

  if (datos.serviceMileage != null && datos.serviceMileage < orden.entryMileage) {
    const mensaje = `El kilometraje de servicio no puede ser menor al de entrada (${orden.entryMileage} km).`;
    throw errors.validation(mensaje, [{ field: 'serviceMileage', message: mensaje }]);
  }

  await withTransaction(async (conn) => {
    await orderModel.updateWork(
      id,
      {
        diagnosis: datos.diagnosis,
        notes: datos.notes,
        recommendations: datos.recommendations,
        serviceMileage: datos.serviceMileage
      },
      conn
    );
    if (datos.serviceMileage != null) {
      // El candado del vehículo serializa los cambios de kilometraje; el vehículo nunca disminuye.
      const vehiculo = await vehicleModel.findByIdForUpdate(orden.vehicleId, conn);
      if (datos.serviceMileage > vehiculo.currentMileage) {
        await vehicleModel.update(vehiculo.id, { currentMileage: datos.serviceMileage }, conn);
      }
    }
  });
  return refresh(user, id);
}

export async function addService(user, id, datos) {
  assertWorkEditable(await loadForWork(user, id));
  await orderModel.insertService(id, datos);
  return refresh(user, id);
}

export async function updateService(user, id, serviceId, datos) {
  assertWorkEditable(await loadForWork(user, id));
  if (!(await orderModel.updateService(id, serviceId, datos))) {
    throw errors.notFound('El servicio no existe en esta orden.');
  }
  return refresh(user, id);
}

export async function removeService(user, id, serviceId) {
  assertWorkEditable(await loadForWork(user, id));
  if (!(await orderModel.deleteService(id, serviceId))) {
    throw errors.notFound('El servicio no existe en esta orden.');
  }
  return refresh(user, id);
}

export async function addLabor(user, id, datos) {
  assertWorkEditable(await loadForWork(user, id));
  await orderModel.insertLabor(id, datos);
  return refresh(user, id);
}

export async function updateLabor(user, id, laborId, datos) {
  assertWorkEditable(await loadForWork(user, id));
  if (!(await orderModel.updateLabor(id, laborId, datos))) {
    throw errors.notFound('La línea de mano de obra no existe en esta orden.');
  }
  return refresh(user, id);
}

export async function removeLabor(user, id, laborId) {
  assertWorkEditable(await loadForWork(user, id));
  if (!(await orderModel.deleteLabor(id, laborId))) {
    throw errors.notFound('La línea de mano de obra no existe en esta orden.');
  }
  return refresh(user, id);
}
