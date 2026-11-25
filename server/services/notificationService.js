// Avisos internos: se calculan al consultar a partir de los módulos de origen (mantenimientos, citas, stock y órdenes)
// para que cada cifra coincida con la de su pantalla. Solo se guarda la lectura de cada usuario (Sprint 6, FR-001 a FR-009).
import * as modeloCitas from '../models/appointmentModel.js';
import * as modeloLecturas from '../models/notificationModel.js';
import * as modeloOrdenes from '../models/orderModel.js';
import * as modeloRefacciones from '../models/partModel.js';
import { NOTICE_PANEL_LIMIT, NOTICE_STALLED_HOURS, NOTICE_TYPE } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { hoyLocal } from './maintenanceClassifier.js';
import { maintenanceService as servicioMantenimientos } from './maintenanceService.js';
import { GROUP_ORDER, buildKey, compareFor, parseKey, typesForRole } from './noticeKeys.js';

const T = NOTICE_TYPE;
const ETIQUETA_ESTADO = {
  RECIBIDO: 'Recibido',
  DIAGNOSTICO: 'Diagnóstico',
  EN_REPARACION: 'En reparación',
  ESPERANDO_REFACCION: 'Esperando refacción',
};

const plural = (n, singular, pluralTexto) => `${n} ${Math.abs(n) === 1 ? singular : pluralTexto}`;

// 'faltan 5 días', 'venció hace 3 días', 'vence hoy'; lo mismo para kilómetros.
function textoDeMargen(daysLeft, kmLeft) {
  const partes = [];
  if (daysLeft !== null && daysLeft !== undefined) {
    if (daysLeft < 0) partes.push(`pasado por ${plural(-daysLeft, 'día', 'días')}`);
    else if (daysLeft === 0) partes.push('vence hoy');
    else partes.push(`faltan ${plural(daysLeft, 'día', 'días')}`);
  }
  if (kmLeft !== null && kmLeft !== undefined) {
    if (kmLeft < 0) partes.push(`pasado por ${(-kmLeft).toLocaleString('es-MX')} km`);
    else if (kmLeft === 0) partes.push('kilometraje alcanzado');
    else partes.push(`faltan ${kmLeft.toLocaleString('es-MX')} km`);
  }
  return partes.join(' · ');
}

export function createNotificationService({
  orderModel = modeloOrdenes,
  appointmentModel = modeloCitas,
  partModel = modeloRefacciones,
  maintenanceService = servicioMantenimientos,
  notificationModel = modeloLecturas,
  hoy = hoyLocal,
} = {}) {
  const deMantenimiento = (m, tipo) => ({
    id: m.id,
    type: tipo,
    key: buildKey(tipo, m.id),
    title: `${m.serviceType} ${tipo === T.MAINTENANCE_OVERDUE ? 'vencido' : 'próximo'}`,
    detail: `${m.vehicle.brand} ${m.vehicle.model} ${m.vehicle.licensePlate} · ${m.client.name} · ${textoDeMargen(m.daysLeft, m.kmLeft)}`,
    data: {
      serviceType: m.serviceType,
      daysLeft: m.daysLeft,
      kmLeft: m.kmLeft,
      client: { id: m.client.id, name: m.client.name },
      vehicle: { id: m.vehicle.id, licensePlate: m.vehicle.licensePlate, title: `${m.vehicle.brand} ${m.vehicle.model}` },
    },
    target: { kind: 'maintenance', id: m.id, search: m.vehicle.licensePlate },
  });

  const deCita = (c) => ({
    id: c.id,
    type: T.APPOINTMENT_TODAY,
    key: buildKey(T.APPOINTMENT_TODAY, c.id),
    title: `Cita de hoy a las ${c.time}`,
    detail: `${c.clientName} · ${c.licensePlate} · ${c.reason}`,
    data: { time: c.time, client: { id: c.clientId, name: c.clientName }, licensePlate: c.licensePlate },
    target: { kind: 'appointment', id: c.id },
  });

  const deRefaccion = (p) => {
    const agotada = p.stockLevel === 'OUT';
    const tipo = agotada ? T.STOCK_OUT : T.STOCK_LOW;
    return {
      id: p.id,
      type: tipo,
      key: buildKey(tipo, p.id),
      title: `${p.name} ${agotada ? 'agotada' : 'con stock bajo'}`,
      detail: `Código ${p.code} · existencia ${p.stock} de mínimo ${p.minimumStock}`,
      data: { code: p.code, name: p.name, stock: p.stock, minimumStock: p.minimumStock },
      target: { kind: 'part', id: p.id },
    };
  };

  const deOrden = (o) => {
    const daysStalled = Math.floor(o.hours / 24);
    return {
      id: o.id,
      type: T.ORDER_STALLED,
      key: buildKey(T.ORDER_STALLED, o.id),
      title: `Orden ${o.folio} detenida`,
      detail: `${o.licensePlate} · ${ETIQUETA_ESTADO[o.status] ?? o.status} · ${plural(daysStalled, 'día', 'días')} sin cambio de estado`,
      data: { folio: o.folio, licensePlate: o.licensePlate, status: o.status, daysStalled },
      target: { kind: 'order', id: o.id },
    };
  };

  // Todos los avisos vigentes que corresponden al rol del usuario (sin tope), agrupados por tipo y en orden de urgencia.
  async function collect(usuario) {
    const permitidos = new Set(typesForRole(usuario.role));
    const quiere = (...tipos) => tipos.some((t) => permitidos.has(t));
    const [mantenimientos, citas, refacciones, ordenes] = await Promise.all([
      quiere(T.MAINTENANCE_OVERDUE, T.MAINTENANCE_SOON)
        ? maintenanceService.listAllClassified({ classification: ['VENCIDO', 'PROXIMO'], onlyActiveClients: true })
        : [],
      quiere(T.APPOINTMENT_TODAY) ? appointmentModel.listByDay(hoy()) : [],
      quiere(T.STOCK_OUT, T.STOCK_LOW) ? partModel.listAlerts() : [],
      quiere(T.ORDER_STALLED)
        ? orderModel.listStalled({
            hours: NOTICE_STALLED_HOURS,
            ...(usuario.role === 'MECHANIC' ? { mechanicId: usuario.id } : {}),
          })
        : [],
    ]);

    const todos = [
      ...mantenimientos.map((m) => deMantenimiento(m, m.classification === 'VENCIDO' ? T.MAINTENANCE_OVERDUE : T.MAINTENANCE_SOON)),
      ...citas.map(deCita),
      ...refacciones.map(deRefaccion),
      ...ordenes.map(deOrden),
    ].filter((aviso) => permitidos.has(aviso.type));

    const porTipo = new Map(GROUP_ORDER.map((tipo) => [tipo, []]));
    for (const aviso of todos) porTipo.get(aviso.type).push(aviso);
    for (const [tipo, lista] of porTipo) lista.sort(compareFor(tipo));
    return porTipo;
  }

  async function get(usuario) {
    const porTipo = await collect(usuario);
    const lecturas = await notificationModel.listReads(usuario.id);
    const leidas = new Set(lecturas);
    const vigentes = new Set([...porTipo.values()].flat().map((aviso) => aviso.key));

    // Un aviso que ya no existe deja de tener lectura: si vuelve a cumplirse, reaparece como no leído (FR-009).
    const obsoletas = lecturas.filter((clave) => !vigentes.has(clave));
    if (obsoletas.length > 0) await notificationModel.deleteReads(usuario.id, obsoletas);

    const groups = [];
    for (const tipo of GROUP_ORDER) {
      const lista = porTipo.get(tipo);
      if (lista.length === 0) continue;
      groups.push({
        type: tipo,
        total: lista.length,
        unread: lista.filter((aviso) => !leidas.has(aviso.key)).length,
        items: lista.slice(0, NOTICE_PANEL_LIMIT).map(({ key, type, title, detail, data, target }) => ({
          key, type, read: leidas.has(key), title, detail, data, target,
        })),
      });
    }

    const respuesta = {
      unread: groups.reduce((suma, g) => suma + g.unread, 0),
      total: groups.reduce((suma, g) => suma + g.total, 0),
      groups,
    };
    if (usuario.role === 'ADMIN') {
      respuesta.stockAlerts = (porTipo.get(T.STOCK_OUT)?.length ?? 0) + (porTipo.get(T.STOCK_LOW)?.length ?? 0);
    }
    return { ...respuesta, limitPerType: NOTICE_PANEL_LIMIT };
  }

  async function markRead(usuario, clave) {
    const analizada = parseKey(clave);
    if (!analizada) {
      throw HttpError.validation('Revisa los datos enviados.', [{ field: 'key', message: 'La clave del aviso no es válida.' }]);
    }
    if (!typesForRole(usuario.role).includes(analizada.type)) throw HttpError.notFound('No se encontró el aviso.');
    const vigentes = await collect(usuario);
    const existe = (vigentes.get(analizada.type) ?? []).some((aviso) => aviso.key === clave);
    if (!existe) return { key: clave, read: false };
    await notificationModel.saveRead(usuario.id, clave);
    return { key: clave, read: true };
  }

  return { get, markRead };
}

export const notificationService = createNotificationService();
