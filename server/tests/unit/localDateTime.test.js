import {
  dayRange,
  formatLocal,
  isFuture,
  isWithinDays,
  parseLocalDateTime
} from '../../utils/localDateTime.js';

describe('fecha y hora local de las citas', () => {
  test('test_interpreta_el_formato_aaaa_mm_ddthh_mm', () => {
    const resultado = parseLocalDateTime('2026-10-20T10:30');

    expect(resultado.sql).toBe('2026-10-20 10:30:00');
    expect(resultado.date.getFullYear()).toBe(2026);
    expect(resultado.date.getHours()).toBe(10);
    expect(resultado.date.getMinutes()).toBe(30);
  });

  test.each([
    ['2026-10-20'],
    ['2026-10-20 10:30'],
    ['2026-13-20T10:30'],
    ['2026-02-30T10:30'],
    ['2026-10-20T25:00'],
    ['2026-10-20T10:60'],
    ['mañana'],
    ['2026-10-20T10:30:00Z'],
    [''],
    [null],
    [undefined]
  ])('test_rechaza_el_formato_invalido_%s', (valor) => {
    expect(parseLocalDateTime(valor)).toBeNull();
  });

  test('test_distingue_el_futuro_del_pasado', () => {
    const ahora = new Date(2026, 9, 12, 12, 0);

    expect(isFuture(new Date(2026, 9, 12, 12, 1), ahora)).toBe(true);
    expect(isFuture(new Date(2026, 9, 12, 12, 0), ahora)).toBe(false);
    expect(isFuture(new Date(2026, 9, 12, 11, 59), ahora)).toBe(false);
  });

  test('test_acepta_hasta_365_dias_de_distancia', () => {
    const ahora = new Date(2026, 9, 12, 12, 0);

    expect(isWithinDays(new Date(2027, 9, 12, 12, 0), 365, ahora)).toBe(true);
    expect(isWithinDays(new Date(2027, 9, 12, 12, 1), 365, ahora)).toBe(false);
    expect(isWithinDays(new Date(2026, 9, 13, 8, 0), 365, ahora)).toBe(true);
  });

  test('test_calcula_el_rango_de_un_dia', () => {
    expect(dayRange('2026-10-20')).toEqual({
      start: '2026-10-20 00:00:00',
      end: '2026-10-20 23:59:59'
    });
    expect(dayRange('2026-10-32')).toBeNull();
    expect(dayRange('20/10/2026')).toBeNull();
  });

  test('test_formatea_una_fecha_como_hora_local_de_pared', () => {
    expect(formatLocal(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});
