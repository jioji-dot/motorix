// Reglas de negocio de los pagos de una orden (US1, US2 y US3).
//
// Toda operación que cambia pagos bloquea primero la fila de la orden y recalcula el saldo con las
// sumas vigentes dentro de la misma transacción (D2): lo aprobado nunca supera el total, ni con
// registros simultáneos. Los pagos nunca se eliminan.
import { randomBytes } from 'node:crypto';
import { PAYMENT_METHOD, PAYMENT_STATUS, ROLES } from '../config/constants.js';
import { withTransaction } from '../config/database.js';
import * as mercadoPago from '../integrations/mercadoPagoClient.js';
import * as orderModel from '../models/orderModel.js';
import * as paymentModel from '../models/paymentModel.js';
import { errors } from '../utils/AppError.js';
import { fromCents, toCents } from '../utils/money.js';
import { canRegisterPayment, computeBalance, toPaymentSummary } from '../utils/paymentBalance.js';
import { normalizePagination } from '../utils/normalizers.js';

/** Acciones que el usuario puede hacer ahora sobre un pago (la interfaz solo ofrece las verdaderas). */
function withActions(pago, user) {
  const { externalId, ...publico } = pago;
  return {
    ...publico,
    canCancel: pago.status === PAYMENT_STATUS.PENDING,
    canVoid: pago.status === PAYMENT_STATUS.APPROVED && user.role === ROLES.ADMIN,
    canRefresh: pago.method === 'MERCADO_PAGO' && pago.status === PAYMENT_STATUS.PENDING
  };
}

/** Resumen de pago de la orden (dentro o fuera de una transacción). */
export async function getPaymentSummary(orderId, db) {
  const orden = await orderModel.findOrderById(orderId, db);
  if (!orden) throw errors.notFound('La orden no existe.');
  const sumas = await paymentModel.sumsByOrder(orderId, db);
  return toPaymentSummary({ totalCents: toCents(orden.total), ...sumas });
}

/** Pagos de una orden con su resumen de saldo. */
export async function getOrderPayments(user, orderId) {
  const resumen = await getPaymentSummary(orderId);
  const pagos = await paymentModel.listByOrder(orderId);
  return { summary: resumen, payments: pagos.map((p) => withActions(p, user)) };
}

/**
 * Bloquea la orden y devuelve su estado de cobro dentro de la transacción: la orden, el total en
 * centavos y el saldo calculado con las sumas vigentes.
 */
export async function lockOrderForPayment(orderId, conn) {
  const bloqueada = await orderModel.lockOrder(orderId, conn);
  if (!bloqueada) throw errors.notFound('La orden no existe.');
  const orden = await orderModel.findOrderById(orderId, conn);
  const totalCents = toCents(orden.total);
  const sumas = await paymentModel.sumsByOrder(orderId, conn);
  return { orden, balance: computeBalance({ totalCents, ...sumas }) };
}

/** La orden debe poder cobrarse y el importe caber en el saldo disponible. */
export function assertCanCharge({ orden, balance }, amountCents) {
  if (!canRegisterPayment({ orderStatus: orden.status, totalCents: balance.totalCents })) {
    throw errors.paymentOrderNotPayable({ status: orden.status, total: fromCents(balance.totalCents) });
  }
  if (amountCents > balance.availableCents) {
    throw errors.paymentExceedsBalance({
      available: fromCents(balance.availableCents),
      requested: fromCents(amountCents)
    });
  }
}

/**
 * Registra un pago en efectivo, tarjeta o transferencia: nace aprobado porque el cobro ocurrió en el
 * taller. Devuelve el pago y el resumen actualizado.
 */
export async function registerPayment(user, orderId, datos) {
  const amountCents = toCents(datos.amount);

  const { id, resumen } = await withTransaction(async (conn) => {
    const estado = await lockOrderForPayment(orderId, conn);
    assertCanCharge(estado, amountCents);

    const nuevoId = await paymentModel.insert(
      {
        orderId,
        method: datos.method,
        amountCents,
        status: PAYMENT_STATUS.APPROVED,
        reference: datos.reference ?? null,
        createdBy: user.id
      },
      conn
    );
    return { id: nuevoId, resumen: await getPaymentSummary(orderId, conn) };
  });

  const pago = await paymentModel.findById(id);
  const respuesta = { payment: withActions(pago, user), summary: resumen };
  // El cambio solo se calcula para mostrarlo al cobrar en efectivo; no se guarda.
  if (datos.receivedAmount !== undefined) {
    respuesta.change = fromCents(toCents(datos.receivedAmount) - amountCents);
  }
  return respuesta;
}

/** Traduce los errores del cliente de Mercado Pago a un 503 claro, sin exponer detalles ni el token. */
function toProviderError(error) {
  if (error instanceof mercadoPago.MercadoPagoError) {
    return error.code === 'MP_NOT_CONFIGURED'
      ? errors.paymentProviderUnavailable('Mercado Pago no está configurado. Cobra con otro método.')
      : errors.paymentProviderUnavailable();
  }
  return error;
}

/** Datos mínimos del cobro pendiente que se muestran en el detalle del error. */
const pendingDetails = (pago) => ({
  id: pago.id,
  amount: pago.amount,
  externalReference: pago.externalReference
});

/** Una orden solo admite un cobro de Mercado Pago pendiente a la vez. */
async function assertNoPendingCharge(orderId, db) {
  const pendiente = await paymentModel.findPendingMercadoPago(orderId, db);
  if (pendiente) throw errors.paymentPendingExists(pendingDetails(pendiente));
}

/**
 * Crea un cobro de Mercado Pago: valida el saldo, crea la preferencia (fuera de la transacción, para no
 * mantener la orden bloqueada durante una llamada externa) y registra el pago PENDIENTE con la orden
 * bloqueada, revalidando saldo y cobro pendiente. Si Mercado Pago falla no se registra nada.
 */
export async function createMercadoPagoCharge(user, orderId, { amount } = {}) {
  // 1. Validación previa: evita crear preferencias que no se podrán usar.
  const previo = await withTransaction((conn) => lockOrderForPayment(orderId, conn));
  await assertNoPendingCharge(orderId);
  const amountCents = amount === undefined ? previo.balance.availableCents : toCents(amount);
  assertCanCharge(previo, amountCents);

  // 2. Preferencia de pago en Mercado Pago.
  const externalReference = `MTX-${previo.orden.folio}-${randomBytes(4).toString('hex').toUpperCase()}`;
  let preferencia;
  try {
    preferencia = await mercadoPago.createPreference({
      title: `Orden ${previo.orden.folio}`,
      amount: fromCents(amountCents),
      externalReference
    });
  } catch (error) {
    throw toProviderError(error);
  }

  // 3. Registro del pago con la orden bloqueada y el saldo recalculado.
  const id = await withTransaction(async (conn) => {
    const estado = await lockOrderForPayment(orderId, conn);
    await assertNoPendingCharge(orderId, conn);
    assertCanCharge(estado, amountCents);
    return paymentModel.insert(
      {
        orderId,
        method: PAYMENT_METHOD.MERCADO_PAGO,
        amountCents,
        status: PAYMENT_STATUS.PENDING,
        externalReference,
        paymentUrl: preferencia.paymentUrl,
        createdBy: user.id
      },
      conn
    );
  });

  const pago = await paymentModel.findById(id);
  return { payment: withActions(pago, user), summary: await getPaymentSummary(orderId) };
}

/** Estados de Mercado Pago que cierran el cobro como rechazado. */
const MP_REJECTED = ['rejected', 'cancelled', 'refunded', 'charged_back'];

/**
 * Consulta a Mercado Pago el resultado de un cobro pendiente y lo aplica. Es idempotente: solo cambia
 * si el pago sigue PENDIENTE al momento de aplicar el resultado, así nunca se aprueba dos veces.
 * El estado nunca se aprueba a mano: solo lo informa Mercado Pago.
 */
export async function refreshPayment(user, id) {
  const existente = await paymentModel.findById(id);
  if (!existente) throw errors.notFound('El pago no existe.');
  if (existente.method !== PAYMENT_METHOD.MERCADO_PAGO || existente.status !== PAYMENT_STATUS.PENDING) {
    throw errors.paymentInvalidState('Solo se puede actualizar el estado de cobros de Mercado Pago pendientes.');
  }

  let resultado;
  try {
    resultado = await mercadoPago.findPaymentByReference(existente.externalReference);
  } catch (error) {
    throw toProviderError(error);
  }

  let nuevoEstado = null;
  if (resultado?.status === 'approved') nuevoEstado = PAYMENT_STATUS.APPROVED;
  else if (resultado && MP_REJECTED.includes(resultado.status)) nuevoEstado = PAYMENT_STATUS.REJECTED;

  if (nuevoEstado) {
    await withTransaction(async (conn) => {
      await orderModel.lockOrder(existente.orderId, conn);
      // Si otro proceso ya lo resolvió, no se aplica nada (idempotencia).
      await paymentModel.updateStatus(id, PAYMENT_STATUS.PENDING, nuevoEstado, { externalId: resultado.id }, conn);
    });
  }

  const actual = await paymentModel.findById(id);
  return { payment: withActions(actual, user), summary: await getPaymentSummary(existente.orderId) };
}

/** Listado de pagos con filtros y paginación. */
export async function listPayments(user, filtros) {
  const paginacion = normalizePagination(filtros);
  const { rows, total, approvedTotal } = await paymentModel.list(
    {
      status: filtros.status,
      method: filtros.method,
      from: filtros.from,
      to: filtros.to,
      search: filtros.search || undefined
    },
    { limit: paginacion.pageSize, offset: paginacion.offset }
  );
  return {
    items: rows.map((p) => withActions(p, user)),
    total,
    approvedTotal,
    page: paginacion.page,
    pageSize: paginacion.pageSize
  };
}

export async function getPayment(user, id) {
  const pago = await paymentModel.findById(id);
  if (!pago) throw errors.notFound('El pago no existe.');
  return withActions(pago, user);
}

/**
 * Cambia el estado de un pago con la orden bloqueada. `aplicar` recibe la conexión y devuelve true si
 * logró el cambio; si el pago ya no está en el estado esperado responde `PAYMENT_INVALID_STATE`.
 */
async function transition(user, id, desde, aplicar, mensaje) {
  const existente = await paymentModel.findById(id);
  if (!existente) throw errors.notFound('El pago no existe.');

  const resumen = await withTransaction(async (conn) => {
    await orderModel.lockOrder(existente.orderId, conn);
    const actual = await paymentModel.lockById(id, conn);
    if (!actual || actual.status !== desde) throw errors.paymentInvalidState(mensaje);
    if (!(await aplicar(conn))) throw errors.paymentInvalidState(mensaje);
    return getPaymentSummary(existente.orderId, conn);
  });
  return { payment: withActions(await paymentModel.findById(id), user), summary: resumen };
}

/** Cancela un pago pendiente y libera el importe que reservaba. */
export function cancelPayment(user, id) {
  return transition(
    user,
    id,
    PAYMENT_STATUS.PENDING,
    (conn) => paymentModel.updateStatus(id, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CANCELLED, {}, conn),
    'Solo se pueden cancelar los pagos pendientes.'
  );
}

/** Anula un pago aprobado con motivo (solo administración); su importe deja de contar como pagado. */
export function voidPayment(user, id, { reason }) {
  return transition(
    user,
    id,
    PAYMENT_STATUS.APPROVED,
    (conn) => paymentModel.markVoided(id, { reason, userId: user.id }, conn),
    'Solo se pueden anular los pagos aprobados.'
  );
}
