// Lógica de negocio de los pagos: saldo de la orden, métodos y estados. El saldo se protege bloqueando la orden
// dentro de la transacción, de modo que cobros simultáneos nunca excedan el total.
import crypto from 'node:crypto';
import { withTransaction } from '../config/db.js';
import { mercadoPagoGateway } from '../integrations/mercadoPagoGateway.js';
import * as modeloPagos from '../models/paymentModel.js';
import { BILLABLE_ORDER_STATUSES, PAYMENT_METHOD, PAYMENT_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { aCentavos } from '../utils/money.js';
import { buildSummary } from './paymentSummary.js';

export function createPaymentService({ paymentModel = modeloPagos, gateway = mercadoPagoGateway, transaction = withTransaction } = {}) {
  async function resumenDe(orderId, orden, conexion) {
    return buildSummary({ total: orden.total, ...(await paymentModel.sums(orderId, conexion)) });
  }

  // Pagos de la orden (del más reciente al más antiguo) con su resumen de cobro.
  async function list(orderId) {
    const orden = await paymentModel.findOrder(orderId);
    if (!orden) throw HttpError.notFound('No se encontró la orden solicitada.');
    const [payments, summary] = await Promise.all([paymentModel.listByOrder(orderId), resumenDe(orderId, orden)]);
    return { payments, summary };
  }

  async function create(orderId, { method, amount, reference }, usuario) {
    const esMercadoPago = method === PAYMENT_METHOD.MERCADO_PAGO;
    // Sin credenciales no se hace nada: ni se bloquea la orden ni se crea un pago a medias.
    if (esMercadoPago && !gateway.isConfigured()) {
      throw new HttpError(503, 'MP_NOT_CONFIGURED', 'Mercado Pago no está configurado en este servidor. Cobra con otro método.');
    }

    const id = await transaction(async (conexion) => {
      const orden = await paymentModel.lockOrder(conexion, orderId);
      if (!orden) throw HttpError.notFound('No se encontró la orden solicitada.');
      if (!BILLABLE_ORDER_STATUSES.includes(orden.status)) {
        throw new HttpError(409, 'ORDER_NOT_PAYABLE', 'Solo se pueden registrar pagos en órdenes Terminadas o Entregadas.');
      }
      if (aCentavos(orden.total) === 0) {
        throw new HttpError(409, 'ORDER_NOT_PAYABLE', 'La orden tiene total cero y no admite pagos.');
      }

      const resumen = await resumenDe(orderId, orden, conexion);
      if (aCentavos(amount) > aCentavos(resumen.available)) {
        throw new HttpError(
          409,
          'PAYMENT_EXCEEDS_BALANCE',
          `El importe excede el saldo disponible de la orden (${resumen.available}).`,
          [{ field: 'amount', message: `El saldo disponible es ${resumen.available}.` }],
          { balance: resumen.available },
        );
      }

      if (!esMercadoPago) {
        return paymentModel.insert(conexion, {
          orderId,
          amount,
          method,
          status: PAYMENT_STATUS.PAID,
          reference,
          createdBy: usuario.id,
        });
      }

      // Mercado Pago: el cobro se solicita con la orden bloqueada; si falla, la transacción se revierte y no queda nada.
      const externalReference = crypto.randomUUID();
      const { link } = await gateway.createPaymentLink({
        amount,
        description: `Orden ${orden.folio}`,
        externalReference,
      });
      return paymentModel.insert(conexion, {
        orderId,
        amount,
        method,
        status: PAYMENT_STATUS.PENDING,
        reference,
        externalReference,
        paymentLink: link,
        createdBy: usuario.id,
      });
    });

    const pagos = await paymentModel.listByOrder(orderId);
    const orden = await paymentModel.findOrder(orderId);
    return { payment: pagos.find((p) => p.id === id), summary: await resumenDe(orderId, orden) };
  }

  return { list, create };
}

export const paymentService = createPaymentService();
