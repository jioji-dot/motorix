import { MAX_IMPORTE_CENTAVOS, exigirDentroDelLimite, importeDeLinea } from '../../services/orderLimits.js';

describe('Límite de importes de una línea y del total de una orden', () => {
  test('el_maximo_es_99999999_99_expresado_en_centavos', () => {
    expect(MAX_IMPORTE_CENTAVOS).toBe(9999999999);
  });

  test('el_importe_de_una_linea_es_cantidad_por_precio_unitario_en_centavos', () => {
    expect(importeDeLinea(3, '0.10')).toBe(30);
    expect(importeDeLinea(2, 150.5)).toBe(30100);
    expect(importeDeLinea(1, '0.00')).toBe(0);
  });

  test('el_limite_es_inclusivo_99999999_99_se_acepta_y_un_centavo_mas_se_rechaza', () => {
    expect(() => exigirDentroDelLimite(9999999999, { campo: 'quantity' })).not.toThrow();
    expect(() => exigirDentroDelLimite(10000000000, { campo: 'quantity' })).toThrow();
  });

  test('rechaza_con_409_AMOUNT_LIMIT_EXCEEDED_el_campo_y_el_maximo_en_el_mensaje', () => {
    let error;
    try {
      exigirDentroDelLimite(importeDeLinea(1000000, '99999999.99'), { campo: 'quantity', descripcion: 'El importe de la línea' });
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({
      status: 409,
      code: 'AMOUNT_LIMIT_EXCEEDED',
      details: [{ field: 'quantity', message: expect.stringContaining('El importe de la línea') }],
    });
    expect(error.message).toContain('99,999,999.99');
  });

  test('un_nuevo_total_que_pasa_del_maximo_se_rechaza_aunque_cada_parte_quepa', () => {
    const totalActual = 9999999900; // 99,999,999.00
    expect(() => exigirDentroDelLimite(totalActual + 99, { campo: 'total' })).not.toThrow();
    expect(() => exigirDentroDelLimite(totalActual + 100, { campo: 'total' })).toThrow();
  });
});
