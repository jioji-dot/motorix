// Arma el comprobante (ticket) de una orden a partir de sus datos. Función pura, sin acceso a la base
// de datos: el contenido se deriva siempre de la orden y de los pagos vigentes (no se guardan copias).
import { DEFAULT_WORKSHOP, PAYMENT_STATUS } from '../config/constants.js';
import { fromCents, toCents } from './money.js';
import { toPaymentSummary } from './paymentBalance.js';

const sumaEnCentavos = (lineas) => lineas.reduce((suma, linea) => suma + toCents(linea.amount), 0);

/** Solo los pagos aprobados y pendientes aparecen en el comprobante. */
const PAGOS_VISIBLES = [PAYMENT_STATUS.APPROVED, PAYMENT_STATUS.PENDING];

const instante = (fecha) => (fecha ? new Date(fecha).getTime() : 0);

/**
 * @param {object} datos
 * @param {{id:number, folio:string, createdAt:Date, generatedByName:string}} datos.ticket
 * @param {object} datos.order orden con folio, estado, kilometrajes y fechas
 * @param {{name:string, phone:string}} datos.client
 * @param {{brand:string, model:string, licensePlate:string}} datos.vehicle
 * @param {Array} datos.services servicios, mano de obra y refacciones de la orden
 * @param {Array} datos.payments todos los pagos de la orden (se filtran los visibles)
 * @param {object} [datos.workshop] datos del taller; usa los predeterminados si faltan
 */
export function buildTicket({ ticket, order, client, vehicle, services, labor, parts, payments = [], workshop }) {
  const serviciosCents = sumaEnCentavos(services);
  const manoDeObraCents = sumaEnCentavos(labor);
  const refaccionesCents = sumaEnCentavos(parts);
  const totalCents = serviciosCents + manoDeObraCents + refaccionesCents;

  const sumarPor = (estado) =>
    payments.filter((p) => p.status === estado).reduce((suma, p) => suma + toCents(p.amount), 0);

  const pagosVisibles = payments
    .filter((p) => PAGOS_VISIBLES.includes(p.status))
    .sort((a, b) => instante(a.createdAt) - instante(b.createdAt) || a.id - b.id)
    .map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
      reference: p.reference ?? null,
      createdAt: p.createdAt
    }));

  return {
    id: ticket.id,
    folio: ticket.folio,
    issuedAt: ticket.createdAt,
    generatedByName: ticket.generatedByName,
    workshop: workshop ?? { ...DEFAULT_WORKSHOP },
    order: {
      id: order.id,
      folio: order.folio,
      status: order.status,
      createdAt: order.createdAt ?? null,
      deliveredAt: order.deliveredAt ?? null
    },
    client: { name: client.name, phone: client.phone },
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      licensePlate: vehicle.licensePlate,
      entryMileage: order.entryMileage,
      serviceMileage: order.serviceMileage ?? null
    },
    services: services.map((s) => ({ description: s.description, amount: Number(s.amount) })),
    labor: labor.map((l) => ({
      description: l.description,
      hours: Number(l.hours),
      hourlyRate: Number(l.hourlyRate),
      amount: Number(l.amount)
    })),
    parts: parts.map((p) => ({
      code: p.code,
      name: p.name,
      quantity: p.quantity,
      unitPrice: Number(p.unitPrice),
      amount: Number(p.amount)
    })),
    subtotals: {
      services: fromCents(serviciosCents),
      labor: fromCents(manoDeObraCents),
      parts: fromCents(refaccionesCents)
    },
    total: fromCents(totalCents),
    payments: pagosVisibles,
    summary: toPaymentSummary({
      totalCents,
      paidCents: sumarPor(PAYMENT_STATUS.APPROVED),
      pendingCents: sumarPor(PAYMENT_STATUS.PENDING)
    })
  };
}
