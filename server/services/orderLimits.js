// Límite de importes: ni el importe de una línea ni el total de una orden pueden superar 99,999,999.99
// (lo que cabe en `DECIMAL(10,2)`). Funciones puras en centavos enteros, sin acceso a la base (FR-003).
import { aCentavos, deCentavos } from '../utils/money.js';
import { HttpError } from '../utils/httpError.js';

// 99,999,999.99 expresado en centavos. El límite es inclusivo.
export const MAX_IMPORTE_CENTAVOS = 9999999999;

// '99999999.99' → '99,999,999.99'
const conComas = (centavos) => deCentavos(centavos).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Importe de una línea: cantidad por precio unitario, en centavos.
export function importeDeLinea(cantidad, precioUnitario) {
  return cantidad * aCentavos(precioUnitario);
}

// Error 409 AMOUNT_LIMIT_EXCEEDED. Si se conoce el importe que se intentó guardar, el detalle lo indica.
export function errorDeLimite({ campo, descripcion = 'El importe', centavos }) {
  const detalle = centavos === undefined ? `${descripcion} supera el máximo.` : `${descripcion} sería ${conComas(centavos)}.`;
  return new HttpError(409, 'AMOUNT_LIMIT_EXCEEDED', `${descripcion} supera el máximo permitido de ${conComas(MAX_IMPORTE_CENTAVOS)}.`, [
    { field: campo, message: detalle },
  ]);
}

// Lanza 409 AMOUNT_LIMIT_EXCEEDED si el importe (en centavos) supera el máximo; `campo` es el campo que se señala.
export function exigirDentroDelLimite(centavos, { campo, descripcion }) {
  if (!(centavos > MAX_IMPORTE_CENTAVOS)) return;
  throw errorDeLimite({ campo, descripcion, centavos });
}

// ¿La base rechazó un valor por salirse del rango de `DECIMAL(10,2)` (errores 1264 y 1690 de MySQL)?
export function esErrorDeRango(error) {
  return error?.errno === 1264 || error?.errno === 1690;
}
