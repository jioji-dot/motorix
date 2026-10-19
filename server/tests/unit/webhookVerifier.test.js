import { parseNotification, signNotification, verifySignature } from '../../services/webhookVerifier.js';

describe('Lectura de notificaciones de Mercado Pago', () => {
  test('lee_el_tipo_y_el_identificador_del_cuerpo', () => {
    expect(parseNotification({ body: { type: 'payment', data: { id: 12345 } } })).toEqual({ type: 'payment', dataId: '12345' });
  });

  test('lee_el_formato_con_parametros_en_la_direccion', () => {
    expect(parseNotification({ query: { topic: 'payment', id: '777' } })).toEqual({ type: 'payment', dataId: '777' });
    expect(parseNotification({ query: { type: 'payment', 'data.id': '888' } })).toEqual({ type: 'payment', dataId: '888' });
  });

  test('otros_tipos_de_notificacion_se_reconocen_sin_identificador', () => {
    expect(parseNotification({ body: { type: 'merchant_order', data: { id: 1 } } })).toEqual({ type: 'merchant_order', dataId: null });
  });

  test('las_notificaciones_mal_formadas_devuelven_null', () => {
    expect(parseNotification({ body: {} })).toBeNull();
    expect(parseNotification({ body: { type: 'payment' } })).toBeNull();
    expect(parseNotification({ body: { type: 'payment', data: { id: 'abc' } } })).toBeNull();
    expect(parseNotification({ body: { type: 'payment', data: { id: "1; DROP TABLE payments" } } })).toBeNull();
    expect(parseNotification({ body: { type: '', data: { id: 1 } } })).toBeNull();
    expect(parseNotification({})).toBeNull();
  });
});

describe('Firma de las notificaciones', () => {
  const secret = 'secreto-de-prueba';
  const base = { secret, requestId: 'req-1', dataId: '12345' };

  test('acepta_una_firma_valida', () => {
    const signatureHeader = signNotification({ ...base, ts: '1700000000' });
    expect(verifySignature({ ...base, signatureHeader })).toBe(true);
  });

  test('rechaza_firmas_alteradas_de_otro_secreto_o_de_otro_pago', () => {
    const valida = signNotification({ ...base, ts: '1700000000' });
    expect(verifySignature({ ...base, signatureHeader: valida.replace(/.$/, '0') })).toBe(false);
    expect(verifySignature({ ...base, secret: 'otro', signatureHeader: valida })).toBe(false);
    expect(verifySignature({ ...base, dataId: '99999', signatureHeader: valida })).toBe(false);
    expect(verifySignature({ ...base, requestId: 'otro', signatureHeader: valida })).toBe(false);
  });

  test('rechaza_encabezados_ausentes_o_incompletos', () => {
    expect(verifySignature({ ...base, signatureHeader: undefined })).toBe(false);
    expect(verifySignature({ ...base, signatureHeader: '' })).toBe(false);
    expect(verifySignature({ ...base, signatureHeader: 'ts=1' })).toBe(false);
    expect(verifySignature({ ...base, signatureHeader: 'v1=abc' })).toBe(false);
    expect(verifySignature({ ...base, signatureHeader: 'basura' })).toBe(false);
  });
});
