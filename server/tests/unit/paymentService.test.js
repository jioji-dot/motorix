import { jest } from '@jest/globals';
import { createPaymentService } from '../../services/paymentService.js';
import { crearPasarelaSimulada } from '../fakeGateway.js';

const conexion = { id: 'conexion' };
const RECEPCION = { id: 2, role: 'RECEPTIONIST' };

function crearEntorno({ orden = { id: 9, folio: 'OS-000009', status: 'TERMINADO', total: '1000.00' }, pagado = '0.00', pendiente = '0.00', gateway } = {}) {
  const paymentModel = {
    findOrder: jest.fn(async () => orden),
    lockOrder: jest.fn(async () => orden),
    sums: jest.fn(async () => ({ paid: pagado, pending: pendiente })),
    insert: jest.fn(async () => 31),
    listByOrder: jest.fn(async () => [{ id: 31, orderId: 9, amount: '400.00', method: 'EFECTIVO', status: 'PAGADO' }]),
  };
  const pasarela = gateway ?? crearPasarelaSimulada();
  const servicio = createPaymentService({ paymentModel, gateway: pasarela, transaction: async (trabajo) => trabajo(conexion) });
  return { servicio, paymentModel, pasarela };
}

describe('Servicio de pagos: reglas de saldo', () => {
  test('registra_un_pago_en_efectivo_como_PAGADO_dentro_de_la_transaccion_con_la_orden_bloqueada', async () => {
    const { servicio, paymentModel } = crearEntorno();
    const resultado = await servicio.create(9, { method: 'EFECTIVO', amount: 400, reference: 'R-1' }, RECEPCION);
    expect(paymentModel.lockOrder).toHaveBeenCalledWith(conexion, 9);
    expect(paymentModel.insert).toHaveBeenCalledWith(conexion, {
      orderId: 9, amount: 400, method: 'EFECTIVO', status: 'PAGADO', reference: 'R-1', createdBy: 2,
    });
    expect(resultado.payment.id).toBe(31);
    expect(resultado.summary.total).toBe('1000.00');
  });

  test('rechaza_ordenes_inexistentes_con_404', async () => {
    const { servicio } = crearEntorno({ orden: null });
    await expect(servicio.create(9, { method: 'EFECTIVO', amount: 10 }, RECEPCION)).rejects.toMatchObject({ status: 404 });
    await expect(servicio.list(9)).rejects.toMatchObject({ status: 404 });
  });

  test('solo_admite_ordenes_terminadas_o_entregadas', async () => {
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'CANCELADA']) {
      const { servicio, paymentModel } = crearEntorno({ orden: { id: 9, folio: 'OS-9', status, total: '1000.00' } });
      await expect(servicio.create(9, { method: 'EFECTIVO', amount: 10 }, RECEPCION)).rejects.toMatchObject({
        status: 409,
        code: 'ORDER_NOT_PAYABLE',
      });
      expect(paymentModel.insert).not.toHaveBeenCalled();
    }
    const entregada = crearEntorno({ orden: { id: 9, folio: 'OS-9', status: 'ENTREGADO', total: '1000.00' } });
    await expect(entregada.servicio.create(9, { method: 'EFECTIVO', amount: 10 }, RECEPCION)).resolves.toBeDefined();
  });

  test('una_orden_con_total_cero_no_admite_pagos', async () => {
    const { servicio } = crearEntorno({ orden: { id: 9, folio: 'OS-9', status: 'TERMINADO', total: '0.00' } });
    await expect(servicio.create(9, { method: 'EFECTIVO', amount: 1 }, RECEPCION)).rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE' });
  });

  test('rechaza_un_importe_mayor_al_disponible_e_indica_el_saldo', async () => {
    const { servicio, paymentModel } = crearEntorno({ pagado: '600.00' });
    await expect(servicio.create(9, { method: 'TARJETA', amount: 400.01 }, RECEPCION)).rejects.toMatchObject({
      status: 409,
      code: 'PAYMENT_EXCEEDS_BALANCE',
      extra: { balance: '400.00' },
    });
    expect(paymentModel.insert).not.toHaveBeenCalled();
  });

  test('acepta_exactamente_el_saldo_disponible', async () => {
    const { servicio, paymentModel } = crearEntorno({ pagado: '600.00' });
    await servicio.create(9, { method: 'TARJETA', amount: 400 }, RECEPCION);
    expect(paymentModel.insert).toHaveBeenCalledTimes(1);
  });

  test('los_pagos_pendientes_de_mercado_pago_reservan_saldo', async () => {
    const { servicio } = crearEntorno({ pagado: '200.00', pendiente: '700.00' });
    await expect(servicio.create(9, { method: 'EFECTIVO', amount: 150 }, RECEPCION)).rejects.toMatchObject({
      code: 'PAYMENT_EXCEEDS_BALANCE',
      extra: { balance: '100.00' },
    });
  });

  test('un_pago_de_mercado_pago_nace_PENDIENTE_con_enlace_y_referencia_externa', async () => {
    const { servicio, paymentModel, pasarela } = crearEntorno();
    await servicio.create(9, { method: 'MERCADO_PAGO', amount: 300 }, RECEPCION);
    const [, datos] = paymentModel.insert.mock.calls[0];
    expect(datos).toMatchObject({ method: 'MERCADO_PAGO', status: 'PENDIENTE', amount: 300 });
    expect(datos.paymentLink).toContain('https://sandbox.mercadopago.test/pagar/');
    expect(datos.externalReference).toMatch(/^[0-9a-f-]{36}$/);
    expect(pasarela.estado.llamadas[0]).toMatchObject({ operacion: 'createPaymentLink', amount: 300, description: 'Orden OS-000009' });
  });

  test('sin_credenciales_responde_503_sin_bloquear_la_orden_ni_crear_nada', async () => {
    const { servicio, paymentModel, pasarela } = crearEntorno({ gateway: crearPasarelaSimulada({ configurada: false }) });
    await expect(servicio.create(9, { method: 'MERCADO_PAGO', amount: 300 }, RECEPCION)).rejects.toMatchObject({
      status: 503,
      code: 'MP_NOT_CONFIGURED',
    });
    expect(paymentModel.lockOrder).not.toHaveBeenCalled();
    expect(paymentModel.insert).not.toHaveBeenCalled();
    expect(pasarela.estado.llamadas).toHaveLength(0);
  });

  test('si_mercado_pago_falla_no_se_crea_ningun_pago', async () => {
    const pasarela = crearPasarelaSimulada();
    pasarela.estado.falla = Object.assign(new Error('x'), { status: 502, code: 'MP_UNAVAILABLE' });
    const { servicio, paymentModel } = crearEntorno({ gateway: pasarela });
    await expect(servicio.create(9, { method: 'MERCADO_PAGO', amount: 300 }, RECEPCION)).rejects.toMatchObject({ code: 'MP_UNAVAILABLE' });
    expect(paymentModel.insert).not.toHaveBeenCalled();
  });

  test('efectivo_tarjeta_y_transferencia_nunca_llaman_a_mercado_pago', async () => {
    const { servicio, pasarela } = crearEntorno();
    for (const method of ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']) {
      await servicio.create(9, { method, amount: 10 }, RECEPCION);
    }
    expect(pasarela.estado.llamadas).toHaveLength(0);
  });
});
