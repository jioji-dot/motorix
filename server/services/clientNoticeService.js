// Clientes por avisar: hechos pendientes (vehículo listo, cita de mañana, mantenimiento próximo o vencido) y registro de
// que una persona avisó al cliente. El sistema no envía ningún mensaje (Sprint 6, FR-015 a FR-019).
import * as modeloCitas from '../models/appointmentModel.js';
import * as modeloAvisosClientes from '../models/clientNoticeModel.js';
import * as modeloOrdenes from '../models/orderModel.js';
import { CLIENT_NOTICE_KIND, MAINTENANCE_CLASS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { hoyLocal } from './maintenanceClassifier.js';
import { maintenanceService as servicioMantenimientos } from './maintenanceService.js';

const K = CLIENT_NOTICE_KIND;
const MOTIVO = {
  [K.ORDER_READY]: 'Vehículo listo',
  [K.APPOINTMENT_TOMORROW]: 'Cita de mañana',
  [K.MAINTENANCE_SOON]: 'Mantenimiento próximo',
  [K.MAINTENANCE_OVERDUE]: 'Mantenimiento vencido',
};

// Fecha 'YYYY-MM-DD' del día siguiente a `fecha`, en hora local.
function diaSiguiente(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return hoyLocal(new Date(anio, mes - 1, dia + 1));
}

// Instante de una fecha del hecho para ordenar: texto 'YYYY-MM-DD' (hora local) o Date.
const instante = (valor) => (typeof valor === 'string' ? new Date(`${valor.slice(0, 10)}T00:00:00`) : new Date(valor)).getTime();

export function createClientNoticeService({
  orderModel = modeloOrdenes,
  appointmentModel = modeloCitas,
  clientNoticeModel = modeloAvisosClientes,
  maintenanceService = servicioMantenimientos,
  hoy = hoyLocal,
} = {}) {
  const deOrden = (o) => ({
    kind: K.ORDER_READY,
    factId: o.id,
    reason: MOTIVO[K.ORDER_READY],
    factDate: o.finishedAt,
    client: { id: o.clientId, name: o.clientName, phone: o.clientPhone },
    vehicle: { id: o.vehicleId, licensePlate: o.licensePlate, title: `${o.brand} ${o.model}` },
    detail: `Orden ${o.folio} terminada`,
    target: { kind: 'order', id: o.id },
  });

  const deCita = (c) => ({
    kind: K.APPOINTMENT_TOMORROW,
    factId: c.id,
    reason: MOTIVO[K.APPOINTMENT_TOMORROW],
    factDate: c.scheduledAt,
    client: { id: c.clientId, name: c.clientName, phone: c.clientPhone },
    vehicle: { id: c.vehicleId, licensePlate: c.licensePlate, title: `${c.brand} ${c.model}` },
    detail: `Cita de mañana a las ${c.time}`,
    target: { kind: 'appointment', id: c.id },
  });

  const deMantenimiento = (m) => {
    const kind = m.classification === MAINTENANCE_CLASS.OVERDUE ? K.MAINTENANCE_OVERDUE : K.MAINTENANCE_SOON;
    return {
      kind,
      factId: m.id,
      reason: MOTIVO[kind],
      // Con solo kilometraje no hay fecha próxima: se usa la fecha en que se registró.
      factDate: m.nextDate ?? m.createdAt,
      client: { id: m.client.id, name: m.client.name, phone: m.client.phone },
      vehicle: { id: m.vehicle.id, licensePlate: m.vehicle.licensePlate, title: `${m.vehicle.brand} ${m.vehicle.model}` },
      detail: m.serviceType,
      target: { kind: 'maintenance', id: m.id },
    };
  };

  // Todos los hechos pendientes (sin los ya avisados), del más antiguo al más reciente.
  async function pendingFacts() {
    const [ordenes, citas, mantenimientos, avisados] = await Promise.all([
      orderModel.listReadyForPickup(),
      appointmentModel.listByDay(diaSiguiente(hoy())),
      maintenanceService.listAllClassified({ classification: ['VENCIDO', 'PROXIMO'], onlyActiveClients: true }),
      clientNoticeModel.listNoticed(),
    ]);
    const yaAvisado = new Set(avisados.map((a) => `${a.kind}:${a.factId}`));
    return [...ordenes.map(deOrden), ...citas.map(deCita), ...mantenimientos.map(deMantenimiento)]
      .filter((h) => !yaAvisado.has(`${h.kind}:${h.factId}`))
      .sort((a, b) => instante(a.factDate) - instante(b.factDate) || a.factId - b.factId);
  }

  async function list({ page, pageSize }) {
    const todos = await pendingFacts();
    const inicio = (page - 1) * pageSize;
    return { items: todos.slice(inicio, inicio + pageSize), meta: { page, pageSize, total: todos.length } };
  }

  async function countPending() {
    return (await pendingFacts()).length;
  }

  // Devuelve { clientId, applicable } del hecho o lanza 404 si el objeto no existe.
  async function resolveFact(kind, factId) {
    if (kind === K.ORDER_READY) {
      const orden = await clientNoticeModel.findOrderFact(factId);
      if (!orden) throw HttpError.notFound('No se encontró la orden indicada.');
      return { clientId: orden.clientId, applicable: orden.status === 'TERMINADO' && orden.clientActive };
    }
    if (kind === K.APPOINTMENT_TOMORROW) {
      const cita = await clientNoticeModel.findAppointmentFact(factId, diaSiguiente(hoy()));
      if (!cita) throw HttpError.notFound('No se encontró la cita indicada.');
      return {
        clientId: cita.clientId,
        applicable: ['PENDIENTE', 'CONFIRMADA'].includes(cita.status) && cita.isOnDay && cita.clientActive,
      };
    }
    const mantenimiento = await maintenanceService.get(factId); // lanza 404 si no existe
    const esperada = kind === K.MAINTENANCE_OVERDUE ? MAINTENANCE_CLASS.OVERDUE : MAINTENANCE_CLASS.SOON;
    return {
      clientId: mantenimiento.client.id,
      applicable: mantenimiento.status === 'PENDIENTE' && mantenimiento.classification === esperada && mantenimiento.client.active !== false,
    };
  }

  // Registra el aviso. Devuelve { created, notice }: `created` es false si el hecho ya estaba avisado.
  async function mark(usuario, { kind, factId, note }) {
    const hecho = await resolveFact(kind, factId);
    const previo = await clientNoticeModel.findByFact(kind, factId);
    if (previo) return { created: false, notice: previo };
    if (!hecho.applicable) {
      throw new HttpError(409, 'NOTICE_NOT_APPLICABLE', 'Este aviso ya no aplica: la situación del cliente cambió. Actualiza la lista.');
    }
    const { created } = await clientNoticeModel.insertIfAbsent(null, { clientId: hecho.clientId, kind, factId, noticedBy: usuario.id, note });
    return { created, notice: await clientNoticeModel.findByFact(kind, factId) };
  }

  return { list, countPending, mark };
}

export const clientNoticeService = createClientNoticeService();
