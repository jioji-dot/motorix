// Resumen de cobro de una orden: cálculo puro con aritmética en centavos.
import { COLLECTION_STATUS } from '../utils/constants.js';
import { aCentavos, deCentavos } from '../utils/money.js';

// `paid` y `pending` son las sumas de los pagos Pagados y Pendientes (los Rechazados y Cancelados no cuentan).
export function buildSummary({ total, paid, pending }) {
  const totalC = aCentavos(total);
  const paidC = aCentavos(paid);
  const pendingC = aCentavos(pending);

  let status;
  if (totalC === 0) status = COLLECTION_STATUS.NO_CHARGE;
  else if (paidC === 0) status = COLLECTION_STATUS.UNPAID;
  else if (paidC < totalC) status = COLLECTION_STATUS.PARTIAL;
  else status = COLLECTION_STATUS.PAID;

  return {
    total: deCentavos(totalC),
    paid: deCentavos(paidC),
    pending: deCentavos(pendingC),
    // Saldo = lo que falta por cobrar; disponible = saldo menos lo reservado por pagos Pendientes de Mercado Pago.
    balance: deCentavos(Math.max(totalC - paidC, 0)),
    available: deCentavos(Math.max(totalC - paidC - pendingC, 0)),
    status,
  };
}
