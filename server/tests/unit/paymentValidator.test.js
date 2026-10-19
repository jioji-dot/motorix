import { createPaymentSchema } from '../../validators/paymentValidator.js';

describe('Validación del alta de pagos', () => {
  const con = (cambios) => createPaymentSchema.safeParse({ method: 'EFECTIVO', amount: 500, ...cambios });

  test('acepta_los_cuatro_metodos_de_pago', () => {
    for (const method of ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO']) {
      expect(con({ method }).success).toBe(true);
    }
  });

  test('un_metodo_invalido_o_ausente_se_rechaza_con_mensaje_en_espanol', () => {
    const invalido = con({ method: 'CHEQUE' });
    expect(invalido.success).toBe(false);
    expect(invalido.error.issues[0].message).toContain('Efectivo, Tarjeta, Transferencia o Mercado Pago');
    expect(con({ method: undefined }).success).toBe(false);
  });

  test('el_importe_va_de_0_01_a_99999999_99_con_hasta_dos_decimales', () => {
    expect(con({ amount: 0.01 }).success).toBe(true);
    expect(con({ amount: 99999999.99 }).success).toBe(true);
    expect(con({ amount: 0 }).success).toBe(false);
    expect(con({ amount: -5 }).success).toBe(false);
    expect(con({ amount: 100000000 }).success).toBe(false);
    expect(con({ amount: 10.123 }).success).toBe(false);
    expect(con({ amount: 'abc' }).success).toBe(false);
    expect(con({ amount: undefined }).success).toBe(false);
    expect(con({ amount: '250.5' }).data.amount).toBe(250.5);
  });

  test('la_referencia_es_opcional_de_hasta_100_caracteres_y_vacia_pasa_a_indefinida', () => {
    expect(con({ reference: 'AUT-123456' }).success).toBe(true);
    expect(con({ reference: 'a'.repeat(100) }).success).toBe(true);
    expect(con({ reference: 'a'.repeat(101) }).success).toBe(false);
    expect(con({ reference: '   ' }).data.reference).toBeUndefined();
    expect(con({}).data.reference).toBeUndefined();
  });

  test('rechaza_referencias_con_forma_de_numero_de_tarjeta', () => {
    for (const reference of ['4111111111111111', '4111 1111 1111 1111', '4111-1111-1111-1111', 'tarjeta 5555555555554444 ok']) {
      const resultado = con({ reference });
      expect(resultado.success).toBe(false);
      expect(resultado.error.issues[0].message).toContain('número de tarjeta');
    }
  });

  test('acepta_numeros_de_autorizacion_y_de_transferencia_cortos', () => {
    for (const reference of ['123456', 'SPEI 0123456789', 'AUT 98765432', '1234 5678']) {
      expect(con({ reference }).success).toBe(true);
    }
  });
});
