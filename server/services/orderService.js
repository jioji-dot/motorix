// Reglas de negocio del ciclo de vida de las órdenes de servicio.
// El trabajo técnico (diagnóstico, servicios, mano de obra) vive en orderWorkService.js.
import { ORDER_STATUS, ROLES } from '../config/constants.js';
import { withTransaction } from '../config/database.js';
import * as appointmentModel from '../models/appointmentModel.js';
import * as clientModel from '../models/clientModel.js';
import * as orderModel from '../models/orderModel.js';
import * as userModel from '../models/userModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { normalizePagination } from '../utils/normalizers.js';
import {
  allowedTransitions,
  allowedTransitionsFor,
  canEditWork,
  canRoleTransition,
  canTransition,
  isBasicDataEditable,
  isNotesEditable,
  isWorkEditable
} from '../utils/orderStatus.js';
import { validateEntryMileage } from './mileageService.js';
import { toPaymentSummary } from '../utils/paymentBalance.js';
import { toCents } from '../utils/money.js';

/** Los pagos son de administración y recepción; el mecánico no los ve. */
const puedeVerPagos = (user) => user?.role === ROLES.ADMIN || user?.role === ROLES.RECEPTIONIST;

/** Resumen de pago de la orden (derivado de los pagos aprobados y pendientes). */
function paymentOf(order) {
  return toPaymentSummary({
    totalCents: toCents(order.total),
    paidCents: toCents(order.paidAmount ?? 0),
    pendingCents: toCents(order.pendingAmount ?? 0)
  });
}

/** Resumen de la orden para listados (sin trabajo técnico ni historial). */
export function toSummary(order, user) {
  return {
    id: order.id,
    folio: order.folio,
    clientId: order.clientId,
    clientName: order.clientName,
    vehicleId: order.vehicleId,
    vehiclePlate: order.vehiclePlate,
    vehicleTitle: order.vehicleTitle,
    mechanicId: order.mechanicId,
    mechanicName: order.mechanicName,
    entryMileage: order.entryMileage,
    reportedProblem: order.reportedProblem,
    status: order.status,
    appointmentId: order.appointmentId,
    total: order.total,
    paymentStatus: puedeVerPagos(user) ? paymentOf(order).status : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

/**
 * Detalle completo de la orden para el usuario que consulta, con las acciones que él puede
 * realizar (`allowedTransitions` y `editable`). El servidor vuelve a validar cada operación.
 */
export async function buildOrderDetail(order, user) {
  const [services, labor, parts, statusHistory] = await Promise.all([
    orderModel.getServices(order.id),
    orderModel.getLabor(order.id),
    orderModel.getParts(order.id),
    orderModel.getHistory(order.id)
  ]);
  const puedeTrabajar = canEditWork(user, order);
  const puedeAdministrar = user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;

  return {
    ...toSummary(order, user),
    payment: puedeVerPagos(user) ? paymentOf(order) : null,
    ticketId: puedeVerPagos(user) ? order.ticketId : null,
    diagnosis: order.diagnosis,
    notes: order.notes,
    recommendations: order.recommendations,
    deliveredAt: order.deliveredAt,
    serviceMileage: order.serviceMileage,
    services,
    labor,
    parts,
    servicesSubtotal: order.servicesSubtotal,
    laborSubtotal: order.laborSubtotal,
    partsSubtotal: order.partsSubtotal,
    statusHistory,
    allowedTransitions: allowedTransitionsFor({ user, order }),
    editable: {
      work: puedeTrabajar && isWorkEditable(order.status),
      parts: puedeTrabajar && isWorkEditable(order.status),
      notesAndRecommendations: puedeTrabajar && isNotesEditable(order.status),
      basicData: puedeAdministrar && isBasicDataEditable(order.status)
    }
  };
}

/** El mecánico indicado debe ser un usuario activo con rol MECHANIC. */
export async function assertAssignableMechanic(mechanicId, db) {
  const usuario = await userModel.findById(mechanicId, db);
  if (!usuario || usuario.role !== ROLES.MECHANIC || !usuario.active) {
    throw errors.validation('El mecánico indicado no es válido: debe ser un mecánico activo.', [
      { field: 'mechanicId', message: 'Elige un mecánico activo.' }
    ]);
  }
  return usuario;
}

/**
 * Crea una orden en una sola transacción (research.md D8): valida el vehículo y el kilometraje,
 * inserta la orden con su folio e historial inicial, actualiza el kilometraje del vehículo y,
 * si viene de una cita, la pasa a EN_PROCESO.
 */
export async function createOrder(user, datos) {
  const id = await withTransaction(async (conn) => {
    let { clientId, vehicleId, reportedProblem } = datos;
    let cita = null;

    if (datos.appointmentId !== undefined) {
      cita = await appointmentModel.findByIdForUpdate(datos.appointmentId, conn);
      if (!cita) throw errors.notFound('La cita no existe.', { field: 'appointmentId' });
      if (!cita.status || cita.orderId !== null || !['PENDIENTE', 'CONFIRMADA'].includes(cita.status)) {
        throw errors.appointmentNotAvailable();
      }
      if (clientId !== undefined && clientId !== cita.clientId) {
        throw errors.validation('El cliente no coincide con el de la cita.', [
          { field: 'clientId', message: 'El cliente no coincide con el de la cita.' }
        ]);
      }
      if (vehicleId !== undefined && vehicleId !== cita.vehicleId) {
        throw errors.validation('El vehículo no coincide con el de la cita.', [
          { field: 'vehicleId', message: 'El vehículo no coincide con el de la cita.' }
        ]);
      }
      clientId = cita.clientId;
      vehicleId = cita.vehicleId;
      reportedProblem = reportedProblem ?? cita.reason;
    }

    const cliente = await clientModel.findById(clientId, conn);
    if (!cliente) throw errors.notFound('El cliente no existe.', { field: 'clientId' });
    // El candado del vehículo serializa las altas de órdenes sobre el mismo auto: evita bloqueos
    // mutuos y valida el kilometraje contra el valor realmente vigente.
    const vehiculo = await vehicleModel.findByIdForUpdate(vehicleId, conn);
    if (!vehiculo) throw errors.notFound('El vehículo no existe.', { field: 'vehicleId' });
    if (vehiculo.clientId !== cliente.id) {
      throw errors.validation('El vehículo no pertenece al cliente indicado.', [
        { field: 'vehicleId', message: 'El vehículo no pertenece al cliente indicado.' }
      ]);
    }

    if (datos.mechanicId !== undefined && datos.mechanicId !== null) {
      await assertAssignableMechanic(datos.mechanicId, conn);
    }

    const entryMileage = validateEntryMileage({
      currentMileage: vehiculo.currentMileage,
      entryMileage: datos.entryMileage,
      mileageCorrection: datos.mileageCorrection === true
    });

    const orderId = await orderModel.insertOrder(
      {
        appointmentId: cita?.id,
        clientId: cliente.id,
        vehicleId: vehiculo.id,
        mechanicId: datos.mechanicId ?? null,
        entryMileage,
        reportedProblem,
        createdBy: user.id
      },
      conn
    );
    await orderModel.setFolio(orderId, conn);
    await orderModel.insertHistory(
      { orderId, fromStatus: null, toStatus: ORDER_STATUS.RECEIVED, changedBy: user.id },
      conn
    );
    await vehicleModel.update(vehiculo.id, { currentMileage: entryMileage }, conn);
    if (cita) await appointmentModel.setStatus(cita.id, ['PENDIENTE', 'CONFIRMADA'], 'EN_PROCESO', conn);
    return orderId;
  });

  return buildOrderDetail(await orderModel.findOrderById(id), user);
}

/**
 * Corrige el problema reportado, el mecánico asignado y/o el kilometraje de entrada mientras
 * la orden no esté TERMINADO ni ENTREGADO (FR-013a). El kilometraje nuevo sigue la misma
 * validación que al crear (FR-012) y actualiza el kilometraje del vehículo.
 */
export async function updateOrderBasics(user, id, datos) {
  await withTransaction(async (conn) => {
    const orden = await orderModel.findOrderById(id, conn);
    if (!orden) throw errors.notFound('La orden no existe.');
    if (!isBasicDataEditable(orden.status)) throw errors.orderNotEditable(orden.status);

    const cambios = {};
    if (datos.reportedProblem !== undefined) cambios.reportedProblem = datos.reportedProblem;

    if (datos.mechanicId !== undefined) {
      if (datos.mechanicId === null) {
        // Quitar al mecánico solo tiene sentido antes de que empiece el trabajo.
        if (orden.status !== ORDER_STATUS.RECEIVED) {
          throw errors.validation('No se puede quitar el mecánico de una orden en proceso.', [
            { field: 'mechanicId', message: 'Solo se puede quitar el mecánico en una orden recibida.' }
          ]);
        }
      } else {
        await assertAssignableMechanic(datos.mechanicId, conn);
      }
      cambios.mechanicId = datos.mechanicId;
    }

    if (datos.entryMileage !== undefined) {
      const vehiculo = await vehicleModel.findByIdForUpdate(orden.vehicleId, conn);
      cambios.entryMileage = validateEntryMileage({
        currentMileage: vehiculo.currentMileage,
        entryMileage: datos.entryMileage,
        mileageCorrection: datos.mileageCorrection === true
      });
      await vehicleModel.update(vehiculo.id, { currentMileage: cambios.entryMileage }, conn);
    }

    await orderModel.updateBasics(id, cambios, conn);
  });

  return buildOrderDetail(await orderModel.findOrderById(id), user);
}

/**
 * Cambia el estado de la orden (FR-023 a FR-027).
 * Orden de las comprobaciones: visibilidad (404) → permiso del rol (403) → transición válida
 * (409) → mecánico asignado y requisitos para terminar (409). El cambio se aplica con una
 * actualización condicionada al estado anterior, junto con el historial y sus efectos en la
 * cita, dentro de una transacción.
 */
export async function changeOrderStatus(user, id, hacia) {
  const orden = await getVisibleOrder(user, id);
  const desde = orden.status;

  if (!canRoleTransition({ user, order: orden, to: hacia })) throw errors.forbidden();
  if (!canTransition(desde, hacia)) {
    throw errors.invalidTransition(desde, hacia, allowedTransitions(desde));
  }

  if (desde === ORDER_STATUS.RECEIVED && orden.mechanicId === null) throw errors.mechanicRequired();

  if (hacia === ORDER_STATUS.FINISHED) {
    const [servicios, manoDeObra] = await Promise.all([
      orderModel.getServices(id),
      orderModel.getLabor(id)
    ]);
    const faltante = [];
    if (!orden.diagnosis || orden.diagnosis.trim() === '') faltante.push('diagnosis');
    if (servicios.length === 0 && manoDeObra.length === 0) faltante.push('servicesOrLabor');
    if (faltante.length > 0) throw errors.orderIncomplete(faltante);
  }

  await withTransaction(async (conn) => {
    const entregar = hacia === ORDER_STATUS.DELIVERED;
    const aplicado = await orderModel.changeStatus(id, desde, hacia, entregar, conn);
    if (!aplicado) {
      // Otra persona cambió el estado entretanto: se informa con el estado vigente.
      const vigente = await orderModel.findOrderById(id, conn);
      throw errors.invalidTransition(vigente.status, hacia, allowedTransitions(vigente.status));
    }
    await orderModel.insertHistory(
      { orderId: id, fromStatus: desde, toStatus: hacia, changedBy: user.id },
      conn
    );
    if (entregar && orden.appointmentId) {
      await appointmentModel.setStatus(orden.appointmentId, ['EN_PROCESO'], 'COMPLETADA', conn);
    }
  });

  return buildOrderDetail(await orderModel.findOrderById(id), user);
}

/**
 * Listado de órdenes. Un mecánico recibe siempre solo las suyas, con las abiertas primero,
 * aunque pida otro mecánico (FR-016).
 */
export async function listOrders(user, filtros) {
  const paginacion = normalizePagination(filtros);
  const esMecanico = user.role === ROLES.MECHANIC;
  const { rows, total } = await orderModel.listOrders({
    status: filtros.status,
    clientId: filtros.clientId,
    mechanicId: esMecanico ? user.id : filtros.mechanicId,
    search: filtros.search || undefined,
    paymentStatus: esMecanico ? undefined : filtros.paymentStatus,
    openFirst: esMecanico,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return {
    items: rows.map((o) => toSummary(o, user)),
    total,
    page: paginacion.page,
    pageSize: paginacion.pageSize
  };
}

/** Orden visible para el usuario; una orden ajena responde igual que una inexistente. */
export async function getVisibleOrder(user, id) {
  const orden = await orderModel.findOrderById(id);
  if (!orden || (user.role === ROLES.MECHANIC && orden.mechanicId !== user.id)) {
    throw errors.notFound('La orden no existe.');
  }
  return orden;
}

export async function getOrder(user, id) {
  return buildOrderDetail(await getVisibleOrder(user, id), user);
}
