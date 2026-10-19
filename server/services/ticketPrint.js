// Página HTML imprimible del ticket: estilos de impresión, sin menús, con todo el texto escapado.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const dinero = (importe) => {
  const [entero, decimales] = Number(importe).toFixed(2).split('.');
  return `$${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
};

const METODOS = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', MERCADO_PAGO: 'Mercado Pago' };
const ESTADOS = { SIN_COBRO: 'Sin cobro', SIN_PAGOS: 'Pendiente', PARCIAL: 'Pago parcial', PAGADA: 'Pagado' };

export const etiquetaDeMetodos = (metodos) => {
  const nombres = metodos.map((m) => METODOS[m] ?? m);
  if (nombres.length === 0) return 'Sin pagos registrados';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
};
export const etiquetaDeEstado = (estado) => ESTADOS[estado] ?? estado;

function fecha(valor) {
  const f = new Date(valor);
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
}

function filas(lineas, columnas) {
  if (lineas.length === 0) return '';
  return lineas.map((l) => `<tr>${columnas(l)}</tr>`).join('');
}

export function renderTicketHtml(t) {
  const servicios = filas(t.services, (l) => `<td>${escapar(l.description)}</td><td class="der">${dinero(l.amount)}</td>`);
  const manoDeObra = filas(
    t.labor,
    (l) => `<td>${escapar(l.description)} <span class="nota">${escapar(l.hours)} h × ${dinero(l.hourlyRate)}</span></td><td class="der">${dinero(l.amount)}</td>`,
  );
  const refacciones = filas(
    t.parts,
    (l) => `<td>${escapar(l.name)} <span class="nota">${escapar(l.quantity)} × ${dinero(l.unitPrice)}</span></td><td class="der">${dinero(l.amount)}</td>`,
  );
  const bloque = (titulo, cuerpo) => (cuerpo ? `<h2>${titulo}</h2><table>${cuerpo}</table>` : '');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket ${escapar(t.folio)}</title>
<style>
  body { font-family: "IBM Plex Sans", Arial, sans-serif; color: #1f2933; margin: 0; padding: 24px; background: #fff; }
  .ticket { max-width: 420px; margin: 0 auto; font-size: 14px; }
  h1 { font-size: 18px; margin: 0; text-align: center; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; margin: 16px 0 4px; border-bottom: 1px solid #ccc; }
  .centro { text-align: center; color: #52606d; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; }
  .der { text-align: right; white-space: nowrap; }
  .nota { color: #52606d; font-size: 12px; }
  .total td { font-weight: bold; font-size: 16px; border-top: 1px solid #1f2933; padding-top: 6px; }
  @media print { body { padding: 0; } @page { margin: 10mm; } }
</style>
</head>
<body>
<div class="ticket">
  <h1>${escapar(t.workshop.name)}</h1>
  <p class="centro">${escapar(t.workshop.address)}<br>${escapar(t.workshop.phone)}</p>
  <h2>Ticket ${escapar(t.folio)}</h2>
  <table>
    <tr><td>Orden</td><td class="der">${escapar(t.order.folio)}</td></tr>
    <tr><td>Fecha</td><td class="der">${fecha(t.generatedAt)}</td></tr>
    <tr><td>Cliente</td><td class="der">${escapar(t.client.name)}</td></tr>
    <tr><td>Vehículo</td><td class="der">${escapar(t.vehicle.description)}</td></tr>
    <tr><td>Placas</td><td class="der">${escapar(t.vehicle.licensePlate)}</td></tr>
    <tr><td>Kilometraje</td><td class="der">${escapar(t.vehicle.mileage)} km</td></tr>
  </table>
  ${bloque('Servicios', servicios)}
  ${bloque('Mano de obra', manoDeObra)}
  ${bloque('Refacciones', refacciones)}
  <h2>Totales</h2>
  <table>
    <tr><td>Subtotal</td><td class="der">${dinero(t.subtotal)}</td></tr>
    <tr class="total"><td>Total</td><td class="der">${dinero(t.total)}</td></tr>
    <tr><td>Método de pago</td><td class="der">${escapar(etiquetaDeMetodos(t.payment.methods))}</td></tr>
    <tr><td>Estado del pago</td><td class="der">${escapar(etiquetaDeEstado(t.payment.status))}</td></tr>
    <tr><td>Pagado</td><td class="der">${dinero(t.payment.paid)}</td></tr>
    <tr><td>Saldo</td><td class="der">${dinero(t.payment.balance)}</td></tr>
  </table>
  <p class="centro">Gracias por su preferencia.</p>
</div>
<script>window.addEventListener('load', function () { window.print(); });</script>
</body>
</html>`;
}

// Página sencilla para un enlace de impresión vencido o inválido.
export function renderTicketError(mensaje) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket no disponible</title></head>
<body style="font-family: Arial, sans-serif; padding: 24px;"><h1>Ticket no disponible</h1><p>${escapar(mensaje)}</p></body></html>`;
}
