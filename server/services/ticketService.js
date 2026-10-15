// Generación y consulta de tickets de servicio. Un ticket por orden terminada o entregada; el
// contenido se arma al consultar, así refleja los pagos vigentes sin guardar copias.
import { BILLABLE_ORDER_STATUSES } from '../config/constants.js';
import { withTransaction } from '../config/database.js';
import * as clientModel from '../models/clientModel.js';
import * as orderModel from '../models/orderModel.js';
import * as paymentModel from '../models/paymentModel.js';
import * as settingsModel from '../models/settingsModel.js';
import * as ticketModel from '../models/ticketModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { fromCents, toCents } from '../utils/money.js';
import { normalizePagination } from '../utils/normalizers.js';
import { toPaymentSummary } from '../utils/paymentBalance.js';
import { buildTicket } from '../utils/ticketBuilder.js';

/** Arma el comprobante con la orden y los pagos vigentes. */
async function composeTicket(ticket) {
  const orden = await orderModel.findOrderById(ticket.orderId);
  const [cliente, vehiculo, servicios, manoDeObra, refacciones, pagos, taller] = await Promise.all([
    clientModel.findById(orden.clientId),
    vehicleModel.findById(orden.vehicleId),
    orderModel.getServices(orden.id),
    orderModel.getLabor(orden.id),
    orderModel.getParts(orden.id),
    paymentModel.listByOrder(orden.id),
    settingsModel.getWorkshopSettings()
  ]);
  return buildTicket({
    ticket,
    order: orden,
    client: cliente,
    vehicle: vehiculo,
    services: servicios,
    labor: manoDeObra,
    parts: refacciones,
    payments: pagos,
    workshop: taller
  });
}

/**
 * Genera el ticket de la orden o devuelve el existente (mismo id y folio). La orden se bloquea para
 * que dos solicitudes simultáneas creen un solo ticket.
 * @returns {Promise<{ticket: object, created: boolean}>}
 */
export async function generateTicket(user, orderId) {
  const { ticketId, created } = await withTransaction(async (conn) => {
    const orden = await orderModel.lockOrder(orderId, conn);
    if (!orden) throw errors.notFound('La orden no existe.');
    if (!BILLABLE_ORDER_STATUSES.includes(orden.status)) throw errors.ticketOrderNotReady();

    const existente = await ticketModel.findByOrderId(orderId, conn);
    if (existente) return { ticketId: existente.id, created: false };

    const id = await ticketModel.insert({ orderId, generatedBy: user.id }, conn);
    await ticketModel.setFolio(id, conn);
    return { ticketId: id, created: true };
  });

  const ticket = await ticketModel.findById(ticketId);
  return { ticket: await composeTicket(ticket), created };
}

export async function getTicket(id) {
  const ticket = await ticketModel.findById(id);
  if (!ticket) throw errors.notFound('El ticket no existe.');
  return composeTicket(ticket);
}

export async function listTickets(filtros) {
  const paginacion = normalizePagination(filtros);
  const { rows, total } = await ticketModel.list({
    search: filtros.search || undefined,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  const items = rows.map((f) => {
    const totalCents = toCents(f.total_amount);
    return {
      id: f.id,
      folio: f.folio,
      issuedAt: f.created_at,
      orderId: f.order_id,
      orderFolio: f.order_folio,
      clientName: f.client_name,
      vehiclePlate: f.license_plate,
      total: fromCents(totalCents),
      paymentStatus: toPaymentSummary({
        totalCents,
        paidCents: toCents(f.paid_amount),
        pendingCents: toCents(f.pending_amount)
      }).status
    };
  });
  return { items, total, page: paginacion.page, pageSize: paginacion.pageSize };
}
