// Estados de los pagos de Mercado Pago: notificaciones, sincronización y cancelación.
// Toda transición usa una actualización condicionada (`WHERE status = 'PENDIENTE'`): es idempotente y segura ante carreras.
import { withTransaction } from '../config/db.js';
import { mercadoPagoGateway } from '../integrations/mercadoPagoGateway.js';
import * as modeloPagos from '../models/paymentModel.js';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { aCentavos } from '../utils/money.js';
import { buildSummary } from './paymentSummary.js';

// Estado de Mercado Pago → estado local; los estados intermedios no cambian nada.
const ESTADO_LOCAL = {
  approved: PAYMENT_STATUS.PAID,
  rejected: PAYMENT_STATUS.REJECTED,
  cancelled: PAYMENT_STATUS.CANCELLED,
  refunded: PAYMENT_STATUS.CANCELLED,
  charged_back: PAYMENT_STATUS.CANCELLED,
};

export function createMercadoPagoService({
  paymentModel = modeloPagos,
  gateway = mercadoPagoGateway,
  transaction = withTransaction,
  logger = console,
} = {}) {
  async function respuestaDe(paymentId) {
    const payment = await paymentModel.findById(paymentId);
    const orden = await paymentModel.findOrder(payment.orderId);
    const summary = buildSummary({ total: orden.total, ...(await paymentModel.sums(payment.orderId)) });
    // Las referencias externas son internas y no se devuelven.
    const publico = { ...payment };
    delete publico.externalReference;
    delete publico.externalId;
    return { payment: publico, summary };
  }

  // Aplica el resultado informado por Mercado Pago a un pago local. Devuelve true si cambió el estado.
  async function aplicar(local, externo) {
    if (!externo) return false;
    // El importe debe coincidir: una notificación que no corresponde se ignora.
    if (aCentavos(externo.amount) !== aCentavos(local.amount)) {
      logger.warn?.(`Mercado Pago: el importe del pago ${local.id} no coincide con el informado; se ignora.`);
      return false;
    }
    const nuevo = ESTADO_LOCAL[externo.status];
    if (!nuevo) return false;

    const filas = await transaction((conexion) =>
      paymentModel.transitionFromPending(conexion, local.id, { status: nuevo, externalId: externo.id }),
    );
    if (filas === 0 && local.status === PAYMENT_STATUS.CANCELLED && nuevo === PAYMENT_STATUS.PAID) {
      // Límite aceptado del MVP: un pago cancelado en Motorix que luego se pagó se concilia fuera del sistema.
      logger.warn?.(`Mercado Pago: el pago ${local.id} ya estaba cancelado y se informó como aprobado; requiere conciliación manual.`);
    }
    return filas === 1;
  }

  // Procesa una notificación: consulta el pago real a Mercado Pago, nunca confía en el contenido recibido.
  async function handleNotification(dataId) {
    const externo = await gateway.getPayment(dataId);
    if (!externo?.externalReference) return { applied: false };
    const local = await paymentModel.findByExternalReference(externo.externalReference);
    if (!local || local.method !== PAYMENT_METHOD.MERCADO_PAGO) return { applied: false };
    return { applied: await aplicar(local, externo) };
  }

  async function exigirPendiente(paymentId) {
    const payment = await paymentModel.findById(paymentId);
    if (!payment) throw HttpError.notFound('No se encontró el pago solicitado.');
    if (payment.method !== PAYMENT_METHOD.MERCADO_PAGO || payment.status !== PAYMENT_STATUS.PENDING) {
      throw new HttpError(409, 'PAYMENT_NOT_PENDING', 'Solo se puede actualizar o cancelar un pago de Mercado Pago que siga Pendiente.');
    }
    return payment;
  }

  // Actualiza bajo demanda el estado de un pago Pendiente consultando a Mercado Pago.
  async function sync(paymentId) {
    const local = await exigirPendiente(paymentId);
    const externo = local.externalId
      ? await gateway.getPayment(local.externalId)
      : await gateway.findPaymentByReference(local.externalReference);
    await aplicar(local, externo);
    return respuestaDe(paymentId);
  }

  async function cancel(paymentId) {
    await exigirPendiente(paymentId);
    const filas = await transaction((conexion) =>
      paymentModel.transitionFromPending(conexion, paymentId, { status: PAYMENT_STATUS.CANCELLED }),
    );
    if (filas === 0) {
      throw new HttpError(409, 'PAYMENT_NOT_PENDING', 'El pago ya no está Pendiente, por lo que no se puede cancelar.');
    }
    return respuestaDe(paymentId);
  }

  return { handleNotification, sync, cancel };
}

export const mercadoPagoService = createMercadoPagoService();
