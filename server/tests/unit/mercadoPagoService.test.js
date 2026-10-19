import { jest } from '@jest/globals';
import { createMercadoPagoService } from '../../services/mercadoPagoService.js';
import { crearPasarelaSimulada } from '../fakeGateway.js';

const conexion = { id: 'conexion' };

function crearEntorno({ pago } = {}) {
  const local = pago === undefined
    ? { id: 4, orderId: 9, amount: '300.00', method: 'MERCADO_PAGO', status: 'PENDIENTE', externalReference: 'ref-4', externalId: null }
    : pago;
  const paymentModel = {
    findById: jest.fn(async () => local),
    findByExternalReference: jest.fn(async (ref) => (local && local.externalReference === ref ? local : null)),
    findOrder: jest.fn(async () => ({ id: 9, total: '1000.00' })),
    sums: jest.fn(async () => ({ paid: '0.00', pending: '300.00' })),
    transitionFromPending: jest.fn(async () => 1),
  };
  const gateway = crearPasarelaSimulada();
  const logger = { warn: jest.fn() };
  const servicio = createMercadoPagoService({ paymentModel, gateway, logger, transaction: async (trabajo) => trabajo(conexion) });
  return { servicio, paymentModel, gateway, logger };
}

describe('Mercado Pago: notificaciones', () => {
  test('una_aprobacion_pasa_el_pago_a_PAGADO_con_actualizacion_condicionada', async () => {
    const { servicio, paymentModel, gateway } = crearEntorno();
    const id = gateway.registrarPagoExterno({ externalReference: 'ref-4', amount: 300, status: 'approved' });
    expect(await servicio.handleNotification(id)).toEqual({ applied: true });
    expect(paymentModel.transitionFromPending).toHaveBeenCalledWith(conexion, 4, { status: 'PAGADO', externalId: id });
  });

  test('rechazado_y_cancelado_se_aplican_como_RECHAZADO_y_CANCELADO', async () => {
    for (const [externo, local] of [['rejected', 'RECHAZADO'], ['cancelled', 'CANCELADO']]) {
      const { servicio, paymentModel, gateway } = crearEntorno();
      const id = gateway.registrarPagoExterno({ externalReference: 'ref-4', amount: 300, status: externo });
      await servicio.handleNotification(id);
      expect(paymentModel.transitionFromPending.mock.calls[0][2].status).toBe(local);
    }
  });

  test('los_estados_intermedios_no_cambian_nada', async () => {
    for (const estado of ['pending', 'in_process', 'authorized']) {
      const { servicio, paymentModel, gateway } = crearEntorno();
      const id = gateway.registrarPagoExterno({ externalReference: 'ref-4', amount: 300, status: estado });
      expect(await servicio.handleNotification(id)).toEqual({ applied: false });
      expect(paymentModel.transitionFromPending).not.toHaveBeenCalled();
    }
  });

  test('repetir_la_notificacion_no_cambia_nada_la_segunda_vez', async () => {
    const { servicio, paymentModel, gateway } = crearEntorno();
    const id = gateway.registrarPagoExterno({ externalReference: 'ref-4', amount: 300 });
    expect((await servicio.handleNotification(id)).applied).toBe(true);
    paymentModel.transitionFromPending.mockResolvedValue(0); // otro proceso ya lo resolvió
    expect((await servicio.handleNotification(id)).applied).toBe(false);
  });

  test('ignora_pagos_inexistentes_ajenos_o_con_importe_distinto', async () => {
    const { servicio, paymentModel, gateway, logger } = crearEntorno();
    expect(await servicio.handleNotification('999')).toEqual({ applied: false }); // no existe en Mercado Pago
    const ajeno = gateway.registrarPagoExterno({ externalReference: 'otra-referencia', amount: 300 });
    expect(await servicio.handleNotification(ajeno)).toEqual({ applied: false });
    const otroImporte = gateway.registrarPagoExterno({ externalReference: 'ref-4', amount: 10 });
    expect(await servicio.handleNotification(otroImporte)).toEqual({ applied: false });
    expect(paymentModel.transitionFromPending).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('una_aprobacion_tardia_de_un_pago_ya_cancelado_se_ignora_y_se_advierte', async () => {
    const { servicio, paymentModel, gateway, logger } = crearEntorno({
      pago: { id: 4, orderId: 9, amount: '300.00', method: 'MERCADO_PAGO', status: 'CANCELADO', externalReference: 'ref-4', externalId: null },
    });
    paymentModel.transitionFromPending.mockResolvedValue(0);
    const id = gateway.registrarPagoExterno({ externalReference: 'ref-4', amount: 300, status: 'approved' });
    expect(await servicio.handleNotification(id)).toEqual({ applied: false });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('conciliación manual'));
  });

  test('un_error_de_mercado_pago_se_propaga_para_que_reintente', async () => {
    const { servicio, gateway } = crearEntorno();
    gateway.estado.falla = Object.assign(new Error('x'), { status: 502, code: 'MP_UNAVAILABLE' });
    await expect(servicio.handleNotification('1')).rejects.toMatchObject({ code: 'MP_UNAVAILABLE' });
  });
});

describe('Mercado Pago: sincronizar y cancelar', () => {
  test('sincronizar_busca_por_referencia_si_aun_no_se_conoce_el_identificador_y_aplica_el_estado', async () => {
    const { servicio, paymentModel, gateway } = crearEntorno();
    gateway.registrarPagoExterno({ externalReference: 'ref-4', amount: 300, status: 'approved' });
    const respuesta = await servicio.sync(4);
    expect(gateway.estado.llamadas[0].operacion).toBe('findPaymentByReference');
    expect(paymentModel.transitionFromPending).toHaveBeenCalled();
    expect(respuesta.summary.total).toBe('1000.00');
    expect(respuesta.payment).not.toHaveProperty('externalReference');
    expect(respuesta.payment).not.toHaveProperty('externalId');
  });

  test('sincronizar_sin_novedades_deja_el_pago_pendiente', async () => {
    const { servicio, paymentModel } = crearEntorno();
    await servicio.sync(4);
    expect(paymentModel.transitionFromPending).not.toHaveBeenCalled();
  });

  test('solo_se_sincroniza_o_cancela_un_pago_de_mercado_pago_pendiente', async () => {
    for (const pago of [
      { id: 4, orderId: 9, amount: '300.00', method: 'MERCADO_PAGO', status: 'PAGADO' },
      { id: 4, orderId: 9, amount: '300.00', method: 'EFECTIVO', status: 'PAGADO' },
    ]) {
      const { servicio } = crearEntorno({ pago });
      await expect(servicio.sync(4)).rejects.toMatchObject({ status: 409, code: 'PAYMENT_NOT_PENDING' });
      await expect(servicio.cancel(4)).rejects.toMatchObject({ status: 409, code: 'PAYMENT_NOT_PENDING' });
    }
    const { servicio } = crearEntorno({ pago: null });
    await expect(servicio.sync(4)).rejects.toMatchObject({ status: 404 });
  });

  test('cancelar_pasa_el_pago_a_CANCELADO_y_si_otro_proceso_lo_resolvio_responde_409', async () => {
    const { servicio, paymentModel } = crearEntorno();
    await servicio.cancel(4);
    expect(paymentModel.transitionFromPending).toHaveBeenCalledWith(conexion, 4, { status: 'CANCELADO' });
    paymentModel.transitionFromPending.mockResolvedValue(0);
    await expect(servicio.cancel(4)).rejects.toMatchObject({ code: 'PAYMENT_NOT_PENDING' });
  });
});
