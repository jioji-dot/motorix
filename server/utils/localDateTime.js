// Fecha y hora local de pared del taller (sin zona horaria), formato `YYYY-MM-DDTHH:mm`.
// Se usa en las citas: ver research.md D5 del Sprint 2.

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const p2 = (n) => String(n).padStart(2, '0');

/** Verifica que los componentes formen una fecha real (por ejemplo, rechaza el 30 de febrero). */
function fechaReal(anio, mes, dia, hora = 0, minuto = 0) {
  const fecha = new Date(anio, mes - 1, dia, hora, minuto);
  const coincide =
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia &&
    fecha.getHours() === hora &&
    fecha.getMinutes() === minuto;
  return coincide ? fecha : null;
}

/**
 * Interpreta `YYYY-MM-DDTHH:mm`.
 * @returns {{ date: Date, sql: string } | null} la fecha local y su forma para MySQL, o null si es inválida
 */
export function parseLocalDateTime(valor) {
  if (typeof valor !== 'string') return null;
  const m = FORMATO.exec(valor);
  if (!m) return null;
  const [anio, mes, dia, hora, minuto] = m.slice(1).map(Number);
  if (hora > 23 || minuto > 59) return null;
  const date = fechaReal(anio, mes, dia, hora, minuto);
  if (!date) return null;
  return { date, sql: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:00` };
}

export function isFuture(fecha, ahora = new Date()) {
  return fecha.getTime() > ahora.getTime();
}

/** La fecha no está más allá de `dias` días a partir de `ahora`. */
export function isWithinDays(fecha, dias, ahora = new Date()) {
  const limite = new Date(ahora.getTime());
  limite.setDate(limite.getDate() + dias);
  return fecha.getTime() <= limite.getTime();
}

/** Rango `[inicio, fin]` de un día `YYYY-MM-DD`, en formato MySQL; null si es inválido. */
export function dayRange(dia) {
  if (typeof dia !== 'string') return null;
  const m = FORMATO_DIA.exec(dia);
  if (!m || !fechaReal(Number(m[1]), Number(m[2]), Number(m[3]))) return null;
  return { start: `${dia} 00:00:00`, end: `${dia} 23:59:59` };
}

export function formatLocal(fecha) {
  return `${fecha.getFullYear()}-${p2(fecha.getMonth() + 1)}-${p2(fecha.getDate())}T${p2(fecha.getHours())}:${p2(fecha.getMinutes())}`;
}

/** Día local `YYYY-MM-DD` de la fecha indicada (por omisión, hoy). */
export function todayLocal(ahora = new Date()) {
  return `${ahora.getFullYear()}-${p2(ahora.getMonth() + 1)}-${p2(ahora.getDate())}`;
}

/** Comprueba que `YYYY-MM-DD` sea un día real del calendario (rechaza, por ejemplo, el 30 de febrero). */
export function isValidDay(valor) {
  if (typeof valor !== 'string') return false;
  const m = FORMATO_DIA.exec(valor);
  return Boolean(m) && fechaReal(Number(m[1]), Number(m[2]), Number(m[3])) !== null;
}
