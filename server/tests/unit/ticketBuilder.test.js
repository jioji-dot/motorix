import { buildTicket } from '../../services/ticketBuilder.js';

const taller = { name: 'Taller de prueba', address: 'Calle 1', phone: '5500000000' };
const ticket = { id: 3, folio: 'TK-000003', generatedAt: '2026-10-19T18:30:00.000Z' };
const orden = (extra = {}) => ({
  id: 12, folio: 'OS-000012', status: 'TERMINADO', total: '1425.00', deliveredAt: null, entryMileage: 48000, serviceMileage: 48200,
  clientName: 'Roberto Hernández', clientPhone: '5512345601', brand: 'Nissan', model: 'Versa', year: 2020, licensePlate: 'ABC-123-A', ...extra,
});
const lineas = {
  services: [{ description: 'Banda nueva', amount: '680.00' }],
  labor: [{ description: 'Cambio', hours: '1.50', hourlyRate: '350.00', amount: '525.00' }],
  parts: [{ name: 'Filtro', quantity: 2, unitPrice: '110.00', amount: '220.00' }],
};
const armar = (payments = [], extra = {}) => buildTicket({ ticket, order: orden(extra), ...lineas, payments, workshop: taller });

describe('Armado del ticket', () => {
  test('incluye_todos_los_datos_esperados', () => {
    expect(armar([])).toMatchObject({
      folio: 'TK-000003',
      generatedAt: '2026-10-19T18:30:00.000Z',
      workshop: taller,
      order: { folio: 'OS-000012', status: 'TERMINADO' },
      client: { name: 'Roberto Hernández', phone: '5512345601' },
      vehicle: { description: 'Nissan Versa 2020', licensePlate: 'ABC-123-A', mileage: 48200 },
      services: [{ description: 'Banda nueva', amount: '680.00' }],
      labor: [{ description: 'Cambio', hours: '1.50', hourlyRate: '350.00', amount: '525.00' }],
      parts: [{ name: 'Filtro', quantity: 2, unitPrice: '110.00', amount: '220.00' }],
    });
  });

  test('el_kilometraje_es_el_del_servicio_o_el_de_entrada_si_falta', () => {
    expect(armar([], { serviceMileage: null }).vehicle.mileage).toBe(48000);
    expect(armar([]).vehicle.mileage).toBe(48200);
  });

  test('el_subtotal_es_la_suma_de_las_lineas_y_coincide_con_el_total_de_la_orden', () => {
    const t = armar([]);
    expect(t.subtotal).toBe('1425.00');
    expect(t.total).toBe('1425.00');
    expect(t.subtotal).toBe(t.total);
  });

  test('sin_pagos_el_estado_es_SIN_PAGOS_sin_metodos_y_con_todo_el_saldo', () => {
    expect(armar([]).payment).toEqual({ methods: [], status: 'SIN_PAGOS', paid: '0.00', balance: '1425.00' });
  });

  test('con_un_pago_parcial_el_estado_es_PARCIAL', () => {
    const pago = { id: 1, amount: '500.00', method: 'EFECTIVO', status: 'PAGADO' };
    expect(armar([pago]).payment).toEqual({ methods: ['EFECTIVO'], status: 'PARCIAL', paid: '500.00', balance: '925.00' });
  });

  test('con_varios_metodos_los_lista_una_vez_en_el_orden_en_que_se_cobraron', () => {
    const pagos = [
      { id: 2, amount: '425.00', method: 'TARJETA', status: 'PAGADO' },
      { id: 1, amount: '500.00', method: 'EFECTIVO', status: 'PAGADO' },
      { id: 3, amount: '500.00', method: 'EFECTIVO', status: 'PAGADO' },
    ];
    expect(armar(pagos).payment).toEqual({ methods: ['EFECTIVO', 'TARJETA'], status: 'PAGADA', paid: '1425.00', balance: '0.00' });
  });

  test('los_pagos_rechazados_cancelados_y_pendientes_no_cuentan', () => {
    const pagos = [
      { id: 1, amount: '1425.00', method: 'MERCADO_PAGO', status: 'RECHAZADO' },
      { id: 2, amount: '100.00', method: 'MERCADO_PAGO', status: 'CANCELADO' },
      { id: 3, amount: '200.00', method: 'MERCADO_PAGO', status: 'PENDIENTE' },
    ];
    expect(armar(pagos).payment).toEqual({ methods: [], status: 'SIN_PAGOS', paid: '0.00', balance: '1425.00' });
  });

  test('una_orden_con_total_cero_se_marca_SIN_COBRO', () => {
    const t = buildTicket({ ticket, order: orden({ total: '0.00' }), services: [], labor: [], parts: [], payments: [], workshop: taller });
    expect(t).toMatchObject({ subtotal: '0.00', total: '0.00', payment: { status: 'SIN_COBRO' } });
  });
});
