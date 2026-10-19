import { stockLevelOf } from '../../models/partModel.js';

describe('Nivel de stock', () => {
  const nivel = (stock, minimumStock, active = true) => stockLevelOf({ stock, minimumStock, active });

  test('con_cero_piezas_esta_agotada', () => {
    expect(nivel(0, 5)).toBe('OUT');
    expect(nivel(0, 0)).toBe('OUT');
  });

  test('el_limite_exacto_cuenta_como_stock_bajo', () => {
    expect(nivel(5, 5)).toBe('LOW');
    expect(nivel(1, 5)).toBe('LOW');
    expect(nivel(1, 1)).toBe('LOW');
  });

  test('por_encima_del_minimo_esta_en_orden', () => {
    expect(nivel(6, 5)).toBe('OK');
    expect(nivel(1, 0)).toBe('OK');
  });

  test('las_refacciones_inactivas_no_tienen_nivel', () => {
    expect(nivel(0, 5, false)).toBeNull();
    expect(nivel(2, 5, false)).toBeNull();
  });
});
