// Saldo y estado de pago de una orden: reglas puras, sin acceso a la base de datos (D1 y D3).
//   total      → servicios + mano de obra + refacciones de la orden
//   paid       → suma de pagos APROBADOS
//   pending    → suma de pagos PENDIENTES (cobros de Mercado Pago que reservan saldo)
//   balance    → total − paid (lo que falta por cobrar)
//   available  → total − paid − pending (lo que aún se puede registrar o cobrar)
import { BILLABLE_ORDER_STATUSES, ORDER_PAYMENT_STATUS } from '../config/constants.js';
import { fromCents, toCents } from './money.js';

/** Calcula el saldo con importes en centavos. Nunca devuelve saldos negativos. */
export function computeBalance({ totalCents, paidCents, pendingCents }) {
  const balanceCents = Math.max(totalCents - paidCents, 0);
  const availableCents = Math.max(totalCents - paidCents - pendingCents, 0);

  let status;
  if (totalCents <= 0) status = ORDER_PAYMENT_STATUS.NO_CHARGE;
  else if (paidCents <= 0) status = ORDER_PAYMENT_STATUS.UNPAID;
  else if (paidCents >= totalCents) status = ORDER_PAYMENT_STATUS.PAID;
  else status = ORDER_PAYMENT_STATUS.PARTIAL;

  return { totalCents, paidCents, pendingCents, balanceCents, availableCents, status };
}

/**
 * Resumen de pago en pesos con la forma del contrato (`PaymentSummary`). Acepta los importes en
 * centavos (`totalCents`...) o en pesos/texto de MySQL (`total`...).
 */
export function toPaymentSummary(datos) {
  const centavos = {
    totalCents: datos.totalCents ?? toCents(datos.total ?? 0),
    paidCents: datos.paidCents ?? toCents(datos.paid ?? 0),
    pendingCents: datos.pendingCents ?? toCents(datos.pending ?? 0)
  };
  const r = computeBalance(centavos);
  return {
    total: fromCents(r.totalCents),
    paid: fromCents(r.paidCents),
    pending: fromCents(r.pendingCents),
    balance: fromCents(r.balanceCents),
    available: fromCents(r.availableCents),
    status: r.status
  };
}

/** Solo se cobran órdenes terminadas o entregadas (el total ya no cambia) y con total mayor a cero. */
export function canRegisterPayment({ orderStatus, totalCents }) {
  return BILLABLE_ORDER_STATUSES.includes(orderStatus) && totalCents > 0;
}
