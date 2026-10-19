import { buildSummary } from '../../services/paymentSummary.js';

describe('Resumen de cobro de una orden', () => {
  test('sin_pagos_el_estado_es_SIN_PAGOS_y_todo_el_total_esta_disponible', () => {
    expect(buildSummary({ total: '1000.00', paid: '0.00', pending: '0.00' })).toEqual({
      total: '1000.00',
      paid: '0.00',
      pending: '0.00',
      balance: '1000.00',
      available: '1000.00',
      status: 'SIN_PAGOS',
    });
  });

  test('un_pago_parcial_deja_el_estado_PARCIAL_y_el_saldo_pendiente', () => {
    expect(buildSummary({ total: '1000.00', paid: '350.50', pending: '0' })).toMatchObject({
      balance: '649.50',
      available: '649.50',
      status: 'PARCIAL',
    });
  });

  test('pagos_por_el_total_dejan_la_orden_PAGADA_sin_saldo', () => {
    expect(buildSummary({ total: '4702.50', paid: '4702.50', pending: '0.00' })).toMatchObject({
      balance: '0.00',
      available: '0.00',
      status: 'PAGADA',
    });
  });

  test('un_pago_pendiente_reserva_saldo_pero_no_cuenta_como_pagado', () => {
    const resumen = buildSummary({ total: '1000.00', paid: '200.00', pending: '300.00' });
    expect(resumen).toMatchObject({ paid: '200.00', pending: '300.00', balance: '800.00', available: '500.00', status: 'PARCIAL' });
  });

  test('un_pago_pendiente_por_todo_el_saldo_no_deja_disponible_pero_la_orden_sigue_sin_pagos', () => {
    expect(buildSummary({ total: '500.00', paid: '0', pending: '500.00' })).toMatchObject({
      available: '0.00',
      balance: '500.00',
      status: 'SIN_PAGOS',
    });
  });

  test('con_total_cero_el_estado_es_SIN_COBRO_y_no_hay_nada_disponible', () => {
    expect(buildSummary({ total: '0.00', paid: '0.00', pending: '0.00' })).toMatchObject({ status: 'SIN_COBRO', available: '0.00' });
  });

  test('los_centavos_no_acumulan_error_de_redondeo', () => {
    expect(buildSummary({ total: '0.30', paid: '0.10', pending: '0.20' })).toMatchObject({ available: '0.00', balance: '0.20' });
  });
});
