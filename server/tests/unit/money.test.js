import { aCentavos, deCentavos, sumar } from '../../utils/money.js';

describe('Aritmética de importes en centavos', () => {
  test('convierte_importes_a_centavos_enteros_sin_error_de_punto_flotante', () => {
    expect(aCentavos('1250.50')).toBe(125050);
    expect(aCentavos(0.1)).toBe(10);
    expect(aCentavos('19.99')).toBe(1999);
    expect(aCentavos('0.57')).toBe(57); // 0.57 * 100 = 56.99999999999999 en punto flotante
  });

  test('0_1_mas_0_2_es_exactamente_0_30', () => {
    expect(sumar([0.1, 0.2])).toBe('0.30');
    expect(0.1 + 0.2).not.toBe(0.3); // el problema que se evita
  });

  test('formatea_centavos_con_dos_decimales_y_ceros', () => {
    expect(deCentavos(5)).toBe('0.05');
    expect(deCentavos(100)).toBe('1.00');
    expect(deCentavos(9999999999)).toBe('99999999.99');
    expect(deCentavos(-250)).toBe('-2.50');
  });

  test('suma_listas_de_importes_grandes_y_vacias', () => {
    expect(sumar(['99999999.99', '0.01'])).toBe('100000000.00');
    expect(sumar([])).toBe('0.00');
    expect(sumar(['500.00', '1702.50', '2500.00'])).toBe('4702.50');
  });
});
