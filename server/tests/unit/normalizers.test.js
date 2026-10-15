import {
  normalizeEmail,
  normalizeLicensePlate,
  normalizePagination,
  normalizeVin,
  trimOrNull
} from '../../utils/normalizers.js';

describe('normalizadores', () => {
  test('test_recorta_espacios_y_devuelve_null_si_queda_vacio', () => {
    expect(trimOrNull('  hola  ')).toBe('hola');
    expect(trimOrNull('   ')).toBeNull();
    expect(trimOrNull(undefined)).toBeNull();
  });

  test('test_convierte_el_correo_a_minusculas_sin_espacios', () => {
    expect(normalizeEmail('  Ana@Correo.COM ')).toBe('ana@correo.com');
    expect(normalizeEmail('')).toBeNull();
  });

  test('test_normaliza_la_placa_a_mayusculas_sin_espacios_ni_guiones', () => {
    expect(normalizeLicensePlate(' abc-123 ')).toBe('ABC123');
    expect(normalizeLicensePlate('ab c 12')).toBe('ABC12');
  });

  test('test_normaliza_el_vin_a_mayusculas', () => {
    expect(normalizeVin('1hgcm82633a004352')).toBe('1HGCM82633A004352');
    expect(normalizeVin('')).toBeNull();
  });

  test('test_aplica_los_limites_de_paginacion', () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 20, offset: 0 });
    expect(normalizePagination({ page: '3', pageSize: '10' })).toEqual({
      page: 3,
      pageSize: 10,
      offset: 20
    });
    expect(normalizePagination({ page: '0', pageSize: '500' })).toEqual({
      page: 1,
      pageSize: 100,
      offset: 0
    });
  });
});
