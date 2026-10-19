import { jest } from '@jest/globals';
import { createMercadoPagoGateway } from '../../integrations/mercadoPagoGateway.js';

const configuracion = (extra = {}) => ({ accessToken: 'TEST-secreto-123', webhookSecret: '', notificationUrl: '', apiUrl: 'https://mp.test', ...extra });
const respuesta = (cuerpo, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

describe('Pasarela de Mercado Pago', () => {
  test('sin_token_no_esta_configurada_y_no_sale_a_la_red', async () => {
    const fetchFn = jest.fn();
    const gateway = createMercadoPagoGateway({ config: configuracion({ accessToken: '' }), fetchFn });
    expect(gateway.isConfigured()).toBe(false);
    await expect(gateway.createPaymentLink({ amount: 10, description: 'x', externalReference: 'r' })).rejects.toMatchObject({
      status: 503,
      code: 'MP_NOT_CONFIGURED',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('arma_la_preferencia_con_importe_descripcion_y_referencia_y_devuelve_el_enlace_de_pruebas', async () => {
    const fetchFn = jest.fn(async () => respuesta({ id: 'pref-1', sandbox_init_point: 'https://sandbox/pagar', init_point: 'https://real/pagar' }, 201));
    const gateway = createMercadoPagoGateway({ config: configuracion(), fetchFn });
    const resultado = await gateway.createPaymentLink({ amount: '250.50', description: 'Orden OS-000001', externalReference: 'ref-1' });
    expect(resultado).toEqual({ preferenceId: 'pref-1', link: 'https://sandbox/pagar' });
    const [url, opciones] = fetchFn.mock.calls[0];
    expect(url).toBe('https://mp.test/checkout/preferences');
    expect(opciones.method).toBe('POST');
    expect(opciones.headers.Authorization).toBe('Bearer TEST-secreto-123');
    expect(JSON.parse(opciones.body)).toEqual({
      items: [{ title: 'Orden OS-000001', quantity: 1, unit_price: 250.5, currency_id: 'MXN' }],
      external_reference: 'ref-1',
    });
  });

  test('incluye_la_direccion_de_notificaciones_solo_si_esta_configurada', async () => {
    const fetchFn = jest.fn(async () => respuesta({ id: 'p', init_point: 'https://real/pagar' }, 201));
    const gateway = createMercadoPagoGateway({ config: configuracion({ notificationUrl: 'https://publica.test/webhook' }), fetchFn });
    const { link } = await gateway.createPaymentLink({ amount: 1, description: 'x', externalReference: 'r' });
    expect(link).toBe('https://real/pagar');
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).notification_url).toBe('https://publica.test/webhook');
  });

  test('traduce_errores_de_red_y_respuestas_fallidas_a_MP_UNAVAILABLE_sin_exponer_el_token', async () => {
    const fallas = [
      jest.fn(async () => { throw new Error('ECONNREFUSED con Bearer TEST-secreto-123'); }),
      jest.fn(async () => respuesta({ message: 'error con TEST-secreto-123' }, 500)),
      jest.fn(async () => respuesta({}, 401)),
      jest.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error('json inválido'); } })),
      jest.fn(async () => respuesta({ id: 'p' }, 201)), // sin enlace
    ];
    for (const fetchFn of fallas) {
      const gateway = createMercadoPagoGateway({ config: configuracion(), fetchFn });
      const error = await gateway.createPaymentLink({ amount: 1, description: 'x', externalReference: 'r' }).catch((e) => e);
      expect(error).toMatchObject({ status: 502, code: 'MP_UNAVAILABLE' });
      expect(JSON.stringify({ mensaje: error.message, detalles: error.details })).not.toContain('TEST-secreto-123');
    }
  });

  test('usa_un_tiempo_de_espera_para_no_quedar_colgado', async () => {
    const fetchFn = jest.fn(async () => respuesta({ id: 'p', init_point: 'x' }, 201));
    const gateway = createMercadoPagoGateway({ config: configuracion(), fetchFn });
    await gateway.createPaymentLink({ amount: 1, description: 'x', externalReference: 'r' });
    expect(fetchFn.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  test('consulta_un_pago_y_lo_traduce_a_la_forma_interna', async () => {
    const fetchFn = jest.fn(async () => respuesta({ id: 123, status: 'approved', external_reference: 'ref-9', transaction_amount: 300 }));
    const gateway = createMercadoPagoGateway({ config: configuracion(), fetchFn });
    expect(await gateway.getPayment('123')).toEqual({ id: '123', status: 'approved', externalReference: 'ref-9', amount: 300 });
    expect(fetchFn.mock.calls[0][0]).toBe('https://mp.test/v1/payments/123');
  });

  test('un_pago_inexistente_devuelve_null_y_un_identificador_invalido_ni_siquiera_consulta', async () => {
    const fetchFn = jest.fn(async () => respuesta({}, 404));
    const gateway = createMercadoPagoGateway({ config: configuracion(), fetchFn });
    expect(await gateway.getPayment('999')).toBeNull();
    fetchFn.mockClear();
    expect(await gateway.getPayment('../etc/passwd')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('busca_por_referencia_codificandola_y_devuelve_el_mas_reciente', async () => {
    const fetchFn = jest.fn(async () => respuesta({ results: [{ id: 5, status: 'rejected', external_reference: 'a b', transaction_amount: 10 }] }));
    const gateway = createMercadoPagoGateway({ config: configuracion(), fetchFn });
    expect(await gateway.findPaymentByReference('a b')).toMatchObject({ id: '5', status: 'rejected' });
    expect(fetchFn.mock.calls[0][0]).toContain('external_reference=a%20b');
    fetchFn.mockImplementation(async () => respuesta({ results: [] }));
    expect(await gateway.findPaymentByReference('x')).toBeNull();
  });
});
