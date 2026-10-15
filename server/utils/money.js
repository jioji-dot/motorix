// Aritmética de importes en centavos enteros: evita los errores de coma flotante (SC-002).
// Los importes viajan por la API en pesos con hasta dos decimales y se guardan en DECIMAL(12,2).

/** Convierte pesos (número o texto de MySQL) a centavos enteros. */
export function toCents(pesos) {
  if (pesos === null || pesos === undefined || pesos === '') {
    throw new TypeError('El importe no es un número válido.');
  }
  const numero = Number(pesos);
  if (!Number.isFinite(numero)) throw new TypeError('El importe no es un número válido.');
  // El redondeo corrige restos como 0.1 + 0.2 = 0.30000000000000004.
  return Math.round(numero * 100 + Number.EPSILON * Math.sign(numero));
}

/** Convierte centavos enteros a pesos con dos decimales. */
export function fromCents(centavos) {
  return Math.round(centavos) / 100;
}

/** El importe tiene como máximo dos decimales (tolera el ruido de la coma flotante). */
export function hasAtMostTwoDecimals(pesos) {
  return Math.abs(pesos * 100 - Math.round(pesos * 100)) < 1e-6;
}
