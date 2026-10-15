// Reglas de negocio de los mantenimientos programados (US3).
// Un vehículo tiene a lo sumo un mantenimiento pendiente; los realizados y cancelados se conservan.
import { MAINTENANCE_STATUS, ORDER_STATUS, ROLES } from '../config/constants.js';
import { withTransaction } from '../config/database.js';
import * as maintenanceModel from '../models/maintenanceModel.js';
import * as orderModel from '../models/orderModel.js';
import * as settingsModel from '../models/settingsModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { todayLocal } from '../utils/localDateTime.js';
import { normalizePagination } from '../utils/normalizers.js';

/** Contexto de clasificación: el día de hoy y los umbrales de aviso vigentes. */
async function classificationContext(db) {
  return { today: todayLocal(), thresholds: await settingsModel.getMaintenanceThresholds(db) };
}

/**
 * El usuario puede editar o cerrar el mantenimiento ahora: está pendiente y es administrador o el
 * mecánico asignado a la orden de origen. La interfaz solo ofrece las acciones cuando es verdadero.
 */
export function canManage(user, fila) {
  if (fila.status !== MAINTENANCE_STATUS.PENDING) return false;
  return (
    user.role === ROLES.ADMIN ||
    (user.role === ROLES.MECHANIC && fila.order_mechanic_id === user.id)
  );
}

async function toApi(fila, user, db) {
  const mantenimiento = maintenanceModel.mapMaintenance(fila, await classificationContext(db));
  return { ...mantenimiento, canManage: canManage(user, fila) };
}

const validationError = (campo, mensaje) =>
  errors.validation(mensaje, [{ field: campo, message: mensaje }]);

/**
 * La fecha no puede ser anterior a hoy y el kilometraje no puede ser menor al actual del vehículo
 * (FR-006). Solo se validan los valores que cambian: editar la descripción de un mantenimiento
 * ya vencido no debe fallar.
 */
function assertTargets({ nextDate, nextMileage, anterior, currentMileage }) {
  if (nextDate != null && nextDate !== anterior?.nextDate && nextDate < todayLocal()) {
    throw validationError('nextDate', 'La fecha no puede ser anterior a hoy.');
  }
  if (nextMileage != null && nextMileage !== anterior?.nextMileage && nextMileage < currentMileage) {
    throw validationError(
      'nextMileage',
      `El kilometraje no puede ser menor al actual del vehículo (${currentMileage} km).`
    );
  }
}

/** Mecánico asignado a la orden de origen o administrador; el resto recibe 404 (sin revelar). */
function assertCanManage(user, filaOrdenMecanicoId) {
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.MECHANIC && filaOrdenMecanicoId === user.id) return;
  if (user.role === ROLES.MECHANIC) throw errors.notFound('El mantenimiento no existe.');
  throw errors.forbidden();
}

/**
 * Registra el próximo mantenimiento desde una orden terminada o entregada. Con un pendiente en el
 * vehículo exige `replacePending: true`; entonces el anterior se cancela en la misma transacción.
 */
export async function createMaintenance(user, datos) {
  const orden = await orderModel.findOrderById(datos.orderId);
  if (!orden) throw errors.notFound('La orden no existe.', { field: 'orderId' });
  if (user.role === ROLES.MECHANIC && orden.mechanicId !== user.id) {
    throw errors.notFound('La orden no existe.', { field: 'orderId' });
  }
  if (![ORDER_STATUS.FINISHED, ORDER_STATUS.DELIVERED].includes(orden.status)) {
    throw errors.orderNotFinished();
  }

  const id = await withTransaction(async (conn) => {
    // El candado del vehículo serializa los altas sobre el mismo auto y fija el kilometraje vigente.
    const vehiculo = await vehicleModel.findByIdForUpdate(orden.vehicleId, conn);
    assertTargets({
      nextDate: datos.nextDate,
      nextMileage: datos.nextMileage,
      currentMileage: vehiculo.currentMileage
    });

    const pendiente = await maintenanceModel.findPendingRowByVehicleForUpdate(vehiculo.id, conn);
    if (pendiente) {
      if (datos.replacePending !== true) {
        throw errors.maintenancePendingExists(await toApi(pendiente, user, conn));
      }
      await maintenanceModel.close(pendiente.id, MAINTENANCE_STATUS.CANCELLED, conn);
    }

    return maintenanceModel.insert(
      {
        vehicleId: vehiculo.id,
        orderId: orden.id,
        description: datos.description,
        nextDate: datos.nextDate ?? null,
        nextMileage: datos.nextMileage ?? null,
        createdBy: user.id
      },
      conn
    );
  });
  return getMaintenanceById(user, id);
}

async function getMaintenanceById(user, id) {
  const fila = await maintenanceModel.findRowById(id);
  return toApi(fila, user);
}

/** Detalle: administración y recepción; el mecánico solo de vehículos de sus órdenes asignadas. */
export async function getMaintenance(user, id) {
  const fila = await maintenanceModel.findRowById(id);
  if (!fila) throw errors.notFound('El mantenimiento no existe.');
  if (
    user.role === ROLES.MECHANIC &&
    !(await maintenanceModel.mechanicWorkedVehicle(user.id, fila.vehicle_id))
  ) {
    throw errors.notFound('El mantenimiento no existe.');
  }
  return toApi(fila, user);
}

/** Mantenimientos del vehículo: el pendiente primero y luego los cerrados. */
export async function listVehicleMaintenance(user, vehicleId) {
  if (!(await vehicleModel.findById(vehicleId))) throw errors.notFound('El vehículo no existe.');
  const filas = await maintenanceModel.listRowsByVehicle(vehicleId);
  const contexto = await classificationContext();
  return filas.map((f) => ({
    ...maintenanceModel.mapMaintenance(f, contexto),
    canManage: canManage(user, f)
  }));
}

/** Carga el mantenimiento para modificarlo y comprueba el permiso (404 para un mecánico ajeno). */
async function loadForManage(user, id) {
  const fila = await maintenanceModel.findRowById(id);
  if (!fila) throw errors.notFound('El mantenimiento no existe.');
  assertCanManage(user, fila.order_mechanic_id);
  return fila;
}

/** Edita un mantenimiento pendiente; debe quedar al menos la fecha o el kilometraje. */
export async function updateMaintenance(user, id, datos) {
  await loadForManage(user, id);

  await withTransaction(async (conn) => {
    const fila = await maintenanceModel.findRowById(id, conn);
    const vehiculo = await vehicleModel.findByIdForUpdate(fila.vehicle_id, conn);
    // Se vuelve a leer con el vehículo bloqueado: otro usuario pudo cerrarlo entretanto.
    const actual = await maintenanceModel.findRowById(id, conn);
    if (actual.status !== MAINTENANCE_STATUS.PENDING) throw errors.maintenanceNotPending();

    const nextDate = datos.nextDate !== undefined ? datos.nextDate : actual.next_date;
    const nextMileage = datos.nextMileage !== undefined ? datos.nextMileage : actual.next_mileage;
    if (nextDate == null && nextMileage == null) {
      throw validationError('nextDate', 'Debe quedar la fecha, el kilometraje o ambos.');
    }
    assertTargets({
      nextDate,
      nextMileage,
      anterior: { nextDate: actual.next_date, nextMileage: actual.next_mileage },
      currentMileage: vehiculo.currentMileage
    });

    await maintenanceModel.update(
      id,
      { description: datos.description, nextDate, nextMileage },
      conn
    );
  });
  return getMaintenanceById(user, id);
}

async function closeMaintenance(user, id, status) {
  await loadForManage(user, id);
  await withTransaction(async (conn) => {
    const fila = await maintenanceModel.findRowById(id, conn);
    await vehicleModel.findByIdForUpdate(fila.vehicle_id, conn);
    const actual = await maintenanceModel.findRowById(id, conn);
    if (actual.status !== MAINTENANCE_STATUS.PENDING) throw errors.maintenanceNotPending();
    await maintenanceModel.close(id, status, conn);
  });
  return getMaintenanceById(user, id);
}

export const completeMaintenance = (user, id) =>
  closeMaintenance(user, id, MAINTENANCE_STATUS.DONE);

export const cancelMaintenance = (user, id) =>
  closeMaintenance(user, id, MAINTENANCE_STATUS.CANCELLED);

/**
 * Listado para avisar a los clientes (US4): administración y recepción. Devuelve los mantenimientos
 * con la clasificación calculada y los umbrales vigentes para que la interfaz los explique.
 */
export async function listMaintenance(user, { classification, status, search, page, pageSize }) {
  const paginacion = normalizePagination({ page, pageSize });
  const contexto = await classificationContext();
  const { rows, total } = await maintenanceModel.listForAlerts({
    classification,
    status,
    search: search || undefined,
    today: contexto.today,
    thresholds: contexto.thresholds,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return {
    items: rows.map((f) => ({
      ...maintenanceModel.mapMaintenance(f, contexto),
      canManage: canManage(user, f)
    })),
    meta: {
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
      warningDays: contexto.thresholds.warningDays,
      warningKm: contexto.thresholds.warningKm
    }
  };
}
