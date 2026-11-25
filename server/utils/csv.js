// Escritura de archivos CSV: sin dependencias. UTF-8 con BOM (para que Excel respete los acentos), saltos de línea CRLF y
// celdas neutralizadas contra la inyección de fórmulas (Sprint 7, FR-016).

const INICIOS_PELIGROSOS = ['=', '+', '-', '@', '\t', '\r'];

// Las celdas de texto que empiezan con un carácter de fórmula se escriben con un apóstrofo delante; los números no se tocan.
export function neutralizar(valor) {
  if (typeof valor !== 'string' || valor === '') return valor;
  return INICIOS_PELIGROSOS.includes(valor[0]) ? `'${valor}` : valor;
}

function celda(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(neutralizar(valor));
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function toCsv(columnas, filas) {
  const lineas = [columnas, ...filas].map((fila) => fila.map(celda).join(','));
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}
