// Claves de los avisos, tipos permitidos por rol y orden por urgencia: funciones puras, sin acceso a la base de datos.
// Un aviso se identifica por tipo, objeto y estado (Sprint 6, FR-009): si el estado cambia (Próximo a Vencido,
// stock bajo a agotado) la clave cambia y la lectura anterior ya no aplica.
import { NOTICE_TYPE } from '../utils/constants.js';
import { urgency } from './maintenanceClassifier.js';

const T = NOTICE_TYPE;

// Orden en que el panel muestra los grupos.
export const GROUP_ORDER = Object.freeze([
  T.MAINTENANCE_OVERDUE,
  T.MAINTENANCE_SOON,
  T.APPOINTMENT_TODAY,
  T.STOCK_OUT,
  T.STOCK_LOW,
  T.ORDER_STALLED,
]);

// Cada tipo: prefijo y sufijo de estado de su clave (el sufijo es null cuando el aviso no tiene estado propio).
const FORMATO = Object.freeze({
  [T.MAINTENANCE_OVERDUE]: { prefijo: 'MANT', estado: 'VENCIDO' },
  [T.MAINTENANCE_SOON]: { prefijo: 'MANT', estado: 'PROXIMO' },
  [T.STOCK_OUT]: { prefijo: 'STOCK', estado: 'AGOTADO' },
  [T.STOCK_LOW]: { prefijo: 'STOCK', estado: 'BAJO' },
  [T.APPOINTMENT_TODAY]: { prefijo: 'CITA', estado: null },
  [T.ORDER_STALLED]: { prefijo: 'ORDEN', estado: null },
});

const esIdValido = (id) => Number.isInteger(id) && id > 0;

// 'MANT:12:VENCIDO'
export function buildKey(tipo, id) {
  const formato = FORMATO[tipo];
  if (!formato) throw new Error(`Tipo de aviso desconocido: ${tipo}`);
  if (!esIdValido(id)) throw new Error(`Identificador de aviso inválido: ${id}`);
  return formato.estado ? `${formato.prefijo}:${id}:${formato.estado}` : `${formato.prefijo}:${id}`;
}

// Inverso de buildKey: devuelve { type, id } o null si la clave no tiene un formato válido.
export function parseKey(clave) {
  if (typeof clave !== 'string') return null;
  const partes = clave.split(':');
  if (partes.length < 2 || partes.length > 3 || !/^[1-9]\d*$/.test(partes[1])) return null;
  const [prefijo, texto, estado = null] = partes;
  const tipo = Object.keys(FORMATO).find((t) => FORMATO[t].prefijo === prefijo && FORMATO[t].estado === estado);
  return tipo ? { type: tipo, id: Number(texto) } : null;
}

const TIPOS_POR_ROL = Object.freeze({
  ADMIN: Object.values(T),
  RECEPTIONIST: [T.MAINTENANCE_OVERDUE, T.MAINTENANCE_SOON, T.APPOINTMENT_TODAY, T.ORDER_STALLED],
  MECHANIC: [T.ORDER_STALLED],
});

// Tipos de aviso que el servidor entrega a cada rol (FR-006); un rol desconocido no recibe ninguno.
export function typesForRole(rol) {
  return [...(TIPOS_POR_ROL[rol] ?? [])];
}

const porId = (a, b) => a.id - b.id;

// Comparadores por tipo: el primero de la lista es el más urgente (FR-002).
// Vencidos y próximos: el que menos tiempo tiene (o más se pasó) primero, con la equivalencia de 50 km por día.
const porMantenimiento = (a, b) =>
  urgency({ daysLeft: a.data.daysLeft ?? null, kmLeft: a.data.kmLeft ?? null }) -
    urgency({ daysLeft: b.data.daysLeft ?? null, kmLeft: b.data.kmLeft ?? null }) || porId(a, b);

// Stock: el más por debajo de su mínimo primero y luego por nombre.
const porStock = (a, b) =>
  a.data.stock - a.data.minimumStock - (b.data.stock - b.data.minimumStock) ||
  String(a.data.name).localeCompare(String(b.data.name), 'es') ||
  porId(a, b);

const COMPARADORES = Object.freeze({
  [T.MAINTENANCE_OVERDUE]: porMantenimiento,
  [T.MAINTENANCE_SOON]: porMantenimiento,
  [T.APPOINTMENT_TODAY]: (a, b) => String(a.data.time).localeCompare(String(b.data.time)) || porId(a, b),
  [T.STOCK_OUT]: porStock,
  [T.STOCK_LOW]: porStock,
  // Órdenes detenidas: de más a menos días.
  [T.ORDER_STALLED]: (a, b) => b.data.daysStalled - a.data.daysStalled || porId(a, b),
});

export function compareFor(tipo) {
  const comparador = COMPARADORES[tipo];
  if (!comparador) throw new Error(`Tipo de aviso desconocido: ${tipo}`);
  return comparador;
}
