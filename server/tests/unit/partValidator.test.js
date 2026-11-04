import { createPartSchema, updatePartSchema } from '../../validators/partValidator.js';

const valida = {
  code: 'FIL-001',
  name: 'Filtro de aceite',
  category: 'Aceites y filtros',
  brand: 'Bosch',
  minimumStock: 5,
  purchasePrice: 80,
  salePrice: 120,
};

const mensajesDe = (resultado) => resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

describe('Validación de precios y datos de una refacción (Sprint 5)', () => {
  const con = (cambios) => createPartSchema.safeParse({ ...valida, ...cambios });

  test('rechaza_precios_negativos_no_numericos_vacios_y_con_mas_de_dos_decimales', () => {
    for (const salePrice of [-1, 'abc', '', 12.345, Number.NaN]) {
      expect(con({ salePrice }).success).toBe(false);
    }
    for (const purchasePrice of [-0.01, 'xyz', '', 0.999]) {
      expect(con({ purchasePrice }).success).toBe(false);
    }
  });

  test('el_mensaje_indica_cual_precio_falla', () => {
    expect(mensajesDe(con({ salePrice: -5 })).join(' ')).toContain('El precio de venta');
    expect(mensajesDe(con({ purchasePrice: 12.345 })).join(' ')).toContain('El precio de compra');
  });

  test('el_maximo_99999999_99_se_acepta_y_un_centavo_mas_se_rechaza', () => {
    expect(con({ purchasePrice: 99999999.99, salePrice: 99999999.99 }).success).toBe(true);
    const resultado = con({ salePrice: 100000000 });
    expect(resultado.success).toBe(false);
    expect(mensajesDe(resultado).join(' ')).toContain('99,999,999.99');
  });

  test('el_precio_0_se_permite_en_compra_y_en_venta', () => {
    expect(con({ purchasePrice: 0, salePrice: 0 }).success).toBe(true);
  });

  test('categoria_y_marca_son_obligatorias_de_hasta_60_caracteres', () => {
    expect(con({ category: '' }).success).toBe(false);
    expect(con({ brand: '   ' }).success).toBe(false);
    expect(con({ category: 'a'.repeat(60), brand: 'b'.repeat(60) }).success).toBe(true);
    expect(con({ category: 'a'.repeat(61) }).success).toBe(false);
    expect(con({ brand: 'b'.repeat(61) }).success).toBe(false);
  });

  test('confirmBelowCost_es_un_booleano_opcional_en_el_alta_y_en_la_edicion', () => {
    expect(con({ confirmBelowCost: true }).data.confirmBelowCost).toBe(true);
    expect(con({}).success).toBe(true);
    expect(con({ confirmBelowCost: 'si' }).success).toBe(false);
    expect(updatePartSchema.safeParse({ salePrice: 10, confirmBelowCost: true }).data).toEqual({ salePrice: 10, confirmBelowCost: true });
    expect(updatePartSchema.safeParse({ salePrice: 10, confirmBelowCost: 1 }).success).toBe(false);
  });

  test('una_edicion_con_solo_confirmBelowCost_no_cuenta_como_cambio', () => {
    expect(updatePartSchema.safeParse({ confirmBelowCost: true }).success).toBe(false);
  });
});
