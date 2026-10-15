// Pruebas unitarias de la aritmética de importes en centavos.
import { fromCents, hasAtMostTwoDecimals, toCents } from '../../utils/money.js';

describe('toCents', () => {
  test('test_convierte_pesos_con_centavos_a_enteros', () => {
    expect(toCents(1234.5)).toBe(123450);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(0)).toBe(0);
    expect(toCents(99999999.99)).toBe(9999999999);
  });

  test('test_acepta_decimales_en_texto_como_los_devuelve_mysql', () => {
    expect(toCents('1570.50')).toBe(157050);
    expect(toCents('0.10')).toBe(10);
  });

  test('test_los_errores_de_coma_flotante_no_cambian_los_centavos', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.15)).toBe(115);
    expect(toCents(19.99 * 3)).toBe(5997);
    expect(toCents(33.33 * 3)).toBe(9999);
  });

  test('test_sumar_en_centavos_es_exacto', () => {
    const importes = [0.1, 0.2, 0.3, 1234.56, 0.07];
    const suma = importes.map(toCents).reduce((a, b) => a + b, 0);
    expect(suma).toBe(10 + 20 + 30 + 123456 + 7);
  });

  test('test_rechaza_valores_no_numericos', () => {
    expect(() => toCents('abc')).toThrow();
    expect(() => toCents(undefined)).toThrow();
    expect(() => toCents(null)).toThrow();
    expect(() => toCents(NaN)).toThrow();
    expect(() => toCents(Infinity)).toThrow();
  });
});

describe('fromCents', () => {
  test('test_regresa_el_numero_en_pesos_con_dos_decimales', () => {
    expect(fromCents(123450)).toBe(1234.5);
    expect(fromCents(1)).toBe(0.01);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(-250)).toBe(-2.5);
  });

  test('test_ida_y_vuelta_conserva_el_importe', () => {
    for (const importe of [0.01, 0.1, 1.15, 99.99, 1234.56, 99999999.99]) {
      expect(fromCents(toCents(importe))).toBe(importe);
    }
  });
});

describe('hasAtMostTwoDecimals', () => {
  test('test_acepta_hasta_dos_decimales', () => {
    expect(hasAtMostTwoDecimals(10)).toBe(true);
    expect(hasAtMostTwoDecimals(10.5)).toBe(true);
    expect(hasAtMostTwoDecimals(10.55)).toBe(true);
    expect(hasAtMostTwoDecimals(0.07)).toBe(true);
  });

  test('test_rechaza_mas_de_dos_decimales', () => {
    expect(hasAtMostTwoDecimals(10.555)).toBe(false);
    expect(hasAtMostTwoDecimals(0.001)).toBe(false);
  });
});
