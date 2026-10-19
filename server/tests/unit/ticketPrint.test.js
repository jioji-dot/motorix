import { escapar, etiquetaDeEstado, etiquetaDeMetodos, renderTicketError, renderTicketHtml } from '../../services/ticketPrint.js';

const ticket = (extra = {}) => ({
  folio: 'TK-000003',
  generatedAt: '2026-10-19T18:30:00.000Z',
  workshop: { name: 'Taller Motorix', address: 'Av. Principal 123', phone: '5512345678' },
  order: { folio: 'OS-000012' },
  client: { name: 'Roberto Hernández', phone: '5512345601' },
  vehicle: { description: 'Nissan Versa 2020', licensePlate: 'ABC-123-A', mileage: 48200 },
  services: [{ description: 'Banda nueva', amount: '680.00' }],
  labor: [{ description: 'Cambio de banda', hours: '1.50', hourlyRate: '350.00', amount: '525.00' }],
  parts: [{ name: 'Filtro', quantity: 2, unitPrice: '110.00', amount: '220.00' }],
  subtotal: '1425.00',
  total: '1425.00',
  payment: { methods: ['EFECTIVO', 'TARJETA'], status: 'PAGADA', paid: '1425.00', balance: '0.00' },
  ...extra,
});

describe('Página imprimible del ticket', () => {
  test('contiene_todos_los_datos_del_ticket', () => {
    const html = renderTicketHtml(ticket());
    for (const texto of [
      'Taller Motorix', 'Av. Principal 123', 'TK-000003', 'OS-000012', 'Roberto Hernández', 'Nissan Versa 2020', 'ABC-123-A',
      '48200 km', 'Banda nueva', '$680.00', 'Cambio de banda', '1.50 h', 'Filtro', '2 × $110.00', '$220.00', '$1,425.00',
      'Efectivo y Tarjeta', 'Pagado',
    ]) {
      expect(html).toContain(texto);
    }
  });

  test('incluye_estilos_de_impresion_y_la_llamada_a_imprimir_y_no_tiene_menus_ni_botones', () => {
    const html = renderTicketHtml(ticket());
    expect(html).toContain('@media print');
    expect(html).toContain('window.print()');
    expect(html).not.toMatch(/<nav|<button|<input|<a /);
  });

  test('escapa_el_html_de_todo_texto_variable', () => {
    const malicioso = '<script>alert("x")</script> & \'comillas\'';
    const html = renderTicketHtml(
      ticket({
        client: { name: malicioso, phone: '1' },
        services: [{ description: malicioso, amount: '1.00' }],
        parts: [{ name: malicioso, quantity: 1, unitPrice: '1.00', amount: '1.00' }],
        workshop: { name: malicioso, address: malicioso, phone: malicioso },
      }),
    );
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;comillas&#39;');
  });

  test('omite_las_secciones_sin_lineas', () => {
    const html = renderTicketHtml(ticket({ labor: [], parts: [] }));
    expect(html).toContain('Servicios');
    expect(html).not.toContain('Mano de obra');
    expect(html).not.toContain('Refacciones');
  });

  test('etiquetas_de_metodos_y_estados', () => {
    expect(etiquetaDeMetodos([])).toBe('Sin pagos registrados');
    expect(etiquetaDeMetodos(['EFECTIVO'])).toBe('Efectivo');
    expect(etiquetaDeMetodos(['EFECTIVO', 'TARJETA', 'MERCADO_PAGO'])).toBe('Efectivo, Tarjeta y Mercado Pago');
    expect(etiquetaDeEstado('SIN_PAGOS')).toBe('Pendiente');
    expect(etiquetaDeEstado('PARCIAL')).toBe('Pago parcial');
    expect(etiquetaDeEstado('SIN_COBRO')).toBe('Sin cobro');
  });

  test('la_pagina_de_error_escapa_el_mensaje', () => {
    expect(renderTicketError('<b>vencido</b>')).toContain('&lt;b&gt;vencido&lt;/b&gt;');
    expect(escapar(null)).toBe('');
  });
});
