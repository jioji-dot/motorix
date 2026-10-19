// Armado del contenido del ticket: función pura a partir de la orden, sus líneas y sus pagos.
// El ticket no guarda su contenido: se arma en cada consulta, así que nunca queda desactualizado.
import { PAYMENT_STATUS } from '../utils/constants.js';
import { sumar } from '../utils/money.js';
import { buildSummary } from './paymentSummary.js';

export function buildTicket({ ticket, order, services, labor, parts, payments, workshop }) {
  const subtotal = sumar([...services, ...labor, ...parts].map((linea) => linea.amount));
  const pagados = payments.filter((p) => p.status === PAYMENT_STATUS.PAID);
  const resumen = buildSummary({ total: order.total, paid: sumar(pagados.map((p) => p.amount)), pending: '0.00' });

  // Métodos distintos, en el orden en que se cobraron.
  const methods = [...new Set([...pagados].sort((a, b) => a.id - b.id).map((p) => p.method))];

  return {
    id: ticket.id,
    folio: ticket.folio,
    generatedAt: ticket.generatedAt,
    workshop: { name: workshop.name, address: workshop.address, phone: workshop.phone },
    order: { id: order.id, folio: order.folio, status: order.status, deliveredAt: order.deliveredAt ?? null },
    client: { name: order.clientName, phone: order.clientPhone },
    vehicle: {
      description: `${order.brand} ${order.model} ${order.year}`,
      licensePlate: order.licensePlate,
      mileage: order.serviceMileage ?? order.entryMileage,
    },
    services: services.map(({ description, amount }) => ({ description, amount })),
    labor: labor.map(({ description, hours, hourlyRate, amount }) => ({ description, hours, hourlyRate, amount })),
    parts: parts.map(({ name, quantity, unitPrice, amount }) => ({ name, quantity, unitPrice, amount })),
    subtotal,
    total: resumen.total,
    payment: { methods, status: resumen.status, paid: resumen.paid, balance: resumen.balance },
  };
}
