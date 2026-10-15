// Normalización de datos de entrada antes de validar y guardar.
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants.js';

/** Recorta espacios; devuelve null si el valor queda vacío. */
export function trimOrNull(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

/** Correo en minúsculas y sin espacios sobrantes. */
export function normalizeEmail(valor) {
  const texto = trimOrNull(valor);
  return texto === null ? null : texto.toLowerCase();
}

/** Nombre de usuario sin espacios sobrantes (la base no distingue mayúsculas). */
export function normalizeUsername(valor) {
  return trimOrNull(valor);
}

/** Placa en mayúsculas, sin espacios ni guiones. */
export function normalizeLicensePlate(valor) {
  const texto = trimOrNull(valor);
  return texto === null ? null : texto.replace(/[\s-]+/g, '').toUpperCase();
}

/** Número de identificación vehicular en mayúsculas y sin espacios. */
export function normalizeVin(valor) {
  const texto = trimOrNull(valor);
  return texto === null ? null : texto.replace(/\s+/g, '').toUpperCase();
}

/** Paginación con los límites definidos en constants.js. */
export function normalizePagination({ page, pageSize } = {}) {
  const paginaNumero = Number.parseInt(page, 10);
  const tamanoNumero = Number.parseInt(pageSize, 10);
  const paginaFinal = Number.isFinite(paginaNumero) && paginaNumero > 0 ? paginaNumero : 1;
  let tamanoFinal =
    Number.isFinite(tamanoNumero) && tamanoNumero > 0 ? tamanoNumero : DEFAULT_PAGE_SIZE;
  tamanoFinal = Math.min(tamanoFinal, MAX_PAGE_SIZE);
  return { page: paginaFinal, pageSize: tamanoFinal, offset: (paginaFinal - 1) * tamanoFinal };
}

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
export function escapeLike(texto) {
  return String(texto).replace(/[\\%_]/g, (c) => `\\${c}`);
}
