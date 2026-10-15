// Pruebas unitarias del estado de existencia de una refacción (D10).
import { STOCK_STATUS } from '../../config/constants.js';
import { getStockStatus, isAlert } from '../../utils/stockStatus.js';

describe('getStockStatus', () => {
  test('test_existencia_cero_es_agotada_incluso_con_minimo_cero', () => {
    expect(getStockStatus({ stock: 0, minimumStock: 5 })).toBe(STOCK_STATUS.OUT);
    expect(getStockStatus({ stock: 0, minimumStock: 0 })).toBe(STOCK_STATUS.OUT);
  });

  test('test_existencia_igual_al_minimo_es_stock_bajo', () => {
    expect(getStockStatus({ stock: 5, minimumStock: 5 })).toBe(STOCK_STATUS.LOW);
  });

  test('test_existencia_entre_uno_y_el_minimo_es_stock_bajo', () => {
    expect(getStockStatus({ stock: 1, minimumStock: 5 })).toBe(STOCK_STATUS.LOW);
    expect(getStockStatus({ stock: 4, minimumStock: 5 })).toBe(STOCK_STATUS.LOW);
  });

  test('test_existencia_por_encima_del_minimo_es_normal', () => {
    expect(getStockStatus({ stock: 6, minimumStock: 5 })).toBe(STOCK_STATUS.OK);
    expect(getStockStatus({ stock: 1, minimumStock: 0 })).toBe(STOCK_STATUS.OK);
  });

  test('test_acepta_valores_numericos_en_texto_como_los_devuelve_mysql', () => {
    expect(getStockStatus({ stock: '3', minimumStock: '3' })).toBe(STOCK_STATUS.LOW);
  });
});

describe('isAlert', () => {
  test('test_bajo_y_agotada_son_alerta_y_normal_no', () => {
    expect(isAlert({ stock: 0, minimumStock: 2 })).toBe(true);
    expect(isAlert({ stock: 2, minimumStock: 2 })).toBe(true);
    expect(isAlert({ stock: 3, minimumStock: 2 })).toBe(false);
  });
});
