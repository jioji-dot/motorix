import { jest } from '@jest/globals';
// Pruebas del cliente de Mercado Pago contra el servidor simulado (sin red ni cuentas reales).
import { createPreference, findPaymentByReference } from '../../integrations/mercadoPagoClient.js';
import * as stub from '../helpers/mercadoPagoStub.js';

beforeAll(stub.start);
afterAll(stub.stop);
beforeEach(() => {
  stub.reset();
  process.env.MP_ACCESS_TOKEN = stub.STUB_TOKEN;
  process.env.MP_MODE = 'sandbox';
  process.env.MP_TIMEOUT_MS = '10000';
});

describe('createPreference', () => {
  test('test_envia_titulo_importe_moneda_y_referencia_externa', async () => {
    await createPreference({ title: 'Orden OS-000007', amount: 1234.5, externalReference: 'MTX-OS-000007-ABCD1234' });

    expect(stub.requests).toHaveLength(1);
    const solicitud = stub.requests[0];
    expect(solicitud.method).toBe('POST');
    expect(solicitud.path).toBe('/checkout/preferences');
    expect(solicitud.headers.authorization).toBe(`Bearer ${stub.STUB_TOKEN}`);
    expect(solicitud.body).toEqual(
      expect.objectContaining({
        external_reference: 'MTX-OS-000007-ABCD1234',
        items: [expect.objectContaining({ title: 'Orden OS-000007', quantity: 1, unit_price: 1234.5, currency_id: 'MXN' })]
      })
    );
  });

  test('test_usa_el_enlace_de_pruebas_en_modo_sandbox', async () => {
    const r = await createPreference({ title: 'Orden', amount: 10, externalReference: 'MTX-1' });

    expect(r.paymentUrl).toBe('https://sandbox.mp.test/checkout/PREF-1');
    expect(r.preferenceId).toBe('PREF-1');
  });

  test('test_usa_el_enlace_normal_fuera_del_modo_sandbox', async () => {
    process.env.MP_MODE = 'production';

    const r = await createPreference({ title: 'Orden', amount: 10, externalReference: 'MTX-1' });

    expect(r.paymentUrl).toBe('https://mp.test/checkout/PREF-1');
  });

  test('test_sin_token_lanza_mp_not_configured_sin_llamar_a_la_red', async () => {
    delete process.env.MP_ACCESS_TOKEN;

    await expect(createPreference({ title: 'Orden', amount: 10, externalReference: 'MTX-1' })).rejects.toMatchObject({
      code: 'MP_NOT_CONFIGURED'
    });
    expect(stub.requests).toHaveLength(0);
  });
});

describe('findPaymentByReference', () => {
  test('test_prefiere_el_pago_aprobado_aunque_haya_otros_mas_recientes', async () => {
    stub.setPayments('MTX-1', [
      { id: 3, status: 'rejected', date_created: '2026-10-14T12:00:00.000-06:00' },
      { id: 2, status: 'approved', date_created: '2026-10-14T11:00:00.000-06:00' },
      { id: 1, status: 'pending', date_created: '2026-10-14T10:00:00.000-06:00' }
    ]);

    const pago = await findPaymentByReference('MTX-1');

    expect(pago).toEqual({ id: '2', status: 'approved' });
    expect(stub.requests[0].query.external_reference).toBe('MTX-1');
  });

  test('test_sin_aprobado_devuelve_el_mas_reciente', async () => {
    stub.setPayments('MTX-1', [
      { id: 1, status: 'pending', date_created: '2026-10-14T10:00:00.000-06:00' },
      { id: 3, status: 'rejected', date_created: '2026-10-14T12:00:00.000-06:00' },
      { id: 2, status: 'in_process', date_created: '2026-10-14T11:00:00.000-06:00' }
    ]);

    expect(await findPaymentByReference('MTX-1')).toEqual({ id: '3', status: 'rejected' });
  });

  test('test_sin_resultados_devuelve_null', async () => {
    expect(await findPaymentByReference('MTX-NADA')).toBeNull();
  });

  test('test_sin_token_lanza_mp_not_configured', async () => {
    delete process.env.MP_ACCESS_TOKEN;

    await expect(findPaymentByReference('MTX-1')).rejects.toMatchObject({ code: 'MP_NOT_CONFIGURED' });
  });
});

describe('fallas del proveedor', () => {
  test('test_un_error_500_lanza_mp_unavailable', async () => {
    stub.setFailure('error500');

    await expect(createPreference({ title: 'Orden', amount: 10, externalReference: 'MTX-1' })).rejects.toMatchObject({
      code: 'MP_UNAVAILABLE'
    });
  });

  test('test_una_respuesta_que_no_es_json_lanza_mp_unavailable', async () => {
    stub.setFailure('invalidJson');

    await expect(findPaymentByReference('MTX-1')).rejects.toMatchObject({ code: 'MP_UNAVAILABLE' });
  });

  test('test_el_tiempo_de_espera_agotado_lanza_mp_unavailable', async () => {
    stub.setFailure('slow');
    process.env.MP_TIMEOUT_MS = '200';

    await expect(findPaymentByReference('MTX-1')).rejects.toMatchObject({ code: 'MP_UNAVAILABLE' });
  });

  test('test_una_respuesta_sin_enlace_de_pago_lanza_mp_unavailable', async () => {
    stub.setFailure('invalidJson');

    await expect(createPreference({ title: 'Orden', amount: 10, externalReference: 'MTX-1' })).rejects.toMatchObject({
      code: 'MP_UNAVAILABLE'
    });
  });

  test('test_el_token_rechazado_no_aparece_en_el_mensaje_de_error', async () => {
    process.env.MP_ACCESS_TOKEN = 'TOKEN-INVALIDO-SECRETO';

    const error = await findPaymentByReference('MTX-1').catch((e) => e);

    expect(error.code).toBe('MP_UNAVAILABLE');
    expect(JSON.stringify({ message: error.message, stack: error.stack })).not.toContain('TOKEN-INVALIDO-SECRETO');
  });

  test('test_el_token_no_se_escribe_en_los_registros', async () => {
    const espias = ['log', 'info', 'warn', 'error'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    stub.setFailure('error500');

    await createPreference({ title: 'Orden', amount: 10, externalReference: 'MTX-1' }).catch(() => {});

    const escrito = JSON.stringify(espias.flatMap((e) => e.mock.calls));
    expect(escrito).not.toContain(stub.STUB_TOKEN);
    espias.forEach((e) => e.mockRestore());
  });
});
