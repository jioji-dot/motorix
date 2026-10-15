// Pruebas unitarias del saldo y del estado de pago de una orden (D1 de research.md).
import { ORDER_PAYMENT_STATUS as E } from '../../config/constants.js';
import { canRegisterPayment, computeBalance, toPaymentSummary } from '../../utils/paymentBalance.js';

describe('computeBalance', () => {
  test('test_sin_pagos_el_saldo_es_el_total_y_el_estado_sin_pagar', () => {
    expect(computeBalance({ totalCents: 100000, paidCents: 0, pendingCents: 0 })).toEqual({
      totalCents: 100000,
      paidCents: 0,
      pendingCents: 0,
      balanceCents: 100000,
      availableCents: 100000,
      status: E.UNPAID
    });
  });

  test('test_un_abono_deja_pago_parcial_y_reduce_el_saldo', () => {
    const r = computeBalance({ totalCents: 100000, paidCents: 40000, pendingCents: 0 });

    expect(r.status).toBe(E.PARTIAL);
    expect(r.balanceCents).toBe(60000);
    expect(r.availableCents).toBe(60000);
  });

  test('test_pagar_todo_deja_la_orden_pagada_con_saldo_cero', () => {
    const r = computeBalance({ totalCents: 100000, paidCents: 100000, pendingCents: 0 });

    expect(r.status).toBe(E.PAID);
    expect(r.balanceCents).toBe(0);
    expect(r.availableCents).toBe(0);
  });

  test('test_un_centavo_menos_sigue_siendo_parcial_y_un_centavo_mas_o_igual_es_pagada', () => {
    expect(computeBalance({ totalCents: 100000, paidCents: 99999, pendingCents: 0 }).status).toBe(E.PARTIAL);
    expect(computeBalance({ totalCents: 100000, paidCents: 100000, pendingCents: 0 }).status).toBe(E.PAID);
  });

  test('test_un_cobro_pendiente_reserva_saldo_sin_contar_como_pagado', () => {
    const r = computeBalance({ totalCents: 100000, paidCents: 0, pendingCents: 70000 });

    expect(r.status).toBe(E.UNPAID);
    expect(r.balanceCents).toBe(100000);
    expect(r.availableCents).toBe(30000);
  });

  test('test_abono_mas_cobro_pendiente_reducen_lo_disponible', () => {
    const r = computeBalance({ totalCents: 100000, paidCents: 25000, pendingCents: 50000 });

    expect(r.status).toBe(E.PARTIAL);
    expect(r.balanceCents).toBe(75000);
    expect(r.availableCents).toBe(25000);
  });

  test('test_un_total_cero_no_tiene_cobro', () => {
    const r = computeBalance({ totalCents: 0, paidCents: 0, pendingCents: 0 });

    expect(r.status).toBe(E.NO_CHARGE);
    expect(r.balanceCents).toBe(0);
    expect(r.availableCents).toBe(0);
  });

  test('test_lo_disponible_y_el_saldo_nunca_son_negativos', () => {
    const r = computeBalance({ totalCents: 1000, paidCents: 1000, pendingCents: 500 });

    expect(r.availableCents).toBe(0);
    expect(r.balanceCents).toBe(0);
  });
});

describe('toPaymentSummary', () => {
  test('test_convierte_a_pesos_con_la_forma_del_contrato', () => {
    const resumen = toPaymentSummary({ totalCents: 157050, paidCents: 100000, pendingCents: 20000 });

    expect(resumen).toEqual({
      total: 1570.5,
      paid: 1000,
      pending: 200,
      balance: 570.5,
      available: 370.5,
      status: E.PARTIAL
    });
  });

  test('test_acepta_importes_en_pesos_o_texto_de_mysql', () => {
    const resumen = toPaymentSummary({ total: '1570.50', paid: '1570.50', pending: '0.00' });

    expect(resumen.status).toBe(E.PAID);
    expect(resumen.balance).toBe(0);
  });
});

describe('canRegisterPayment', () => {
  test.each(['TERMINADO', 'ENTREGADO'])('test_se_puede_cobrar_una_orden_%s_con_total', (orderStatus) => {
    expect(canRegisterPayment({ orderStatus, totalCents: 100 })).toBe(true);
  });

  test.each(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'])(
    'test_no_se_puede_cobrar_una_orden_%s',
    (orderStatus) => {
      expect(canRegisterPayment({ orderStatus, totalCents: 100000 })).toBe(false);
    }
  );

  test('test_no_se_cobra_una_orden_con_total_cero', () => {
    expect(canRegisterPayment({ orderStatus: 'ENTREGADO', totalCents: 0 })).toBe(false);
  });
});
