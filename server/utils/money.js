// Aritmética de importes en centavos enteros: ninguna suma de dinero usa números de punto flotante.

// '1250.50' o 1250.5 → 125050
export function aCentavos(importe) {
  return Math.round(Number(importe) * 100);
}

// 125050 → '1250.50'
export function deCentavos(centavos) {
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(Math.round(centavos));
  return `${signo}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, '0')}`;
}

// Suma exacta de una lista de importes (cadenas o números) con resultado en cadena de dos decimales.
export function sumar(importes) {
  return deCentavos(importes.reduce((total, importe) => total + aCentavos(importe), 0));
}
