import { validateEntryMileage } from '../../services/mileageService.js';

describe('validación del kilometraje de entrada', () => {
  test('test_acepta_un_kilometraje_mayor_al_registrado', () => {
    expect(validateEntryMileage({ currentMileage: 1000, entryMileage: 1500 })).toBe(1500);
  });

  test('test_acepta_un_kilometraje_igual_al_registrado', () => {
    expect(validateEntryMileage({ currentMileage: 1000, entryMileage: 1000 })).toBe(1000);
  });

  test('test_rechaza_un_kilometraje_menor_sin_correccion_explicita', () => {
    expect(() => validateEntryMileage({ currentMileage: 1000, entryMileage: 900 })).toThrow(
      expect.objectContaining({ status: 409, code: 'MILEAGE_DECREASE' })
    );
    expect(() =>
      validateEntryMileage({ currentMileage: 1000, entryMileage: 900, mileageCorrection: false })
    ).toThrow(expect.objectContaining({ code: 'MILEAGE_DECREASE' }));
  });

  test('test_acepta_un_kilometraje_menor_con_correccion_explicita', () => {
    expect(
      validateEntryMileage({ currentMileage: 1000, entryMileage: 900, mileageCorrection: true })
    ).toBe(900);
  });

  test('test_un_vehiculo_sin_kilometraje_previo_acepta_cualquier_valor_valido', () => {
    expect(validateEntryMileage({ currentMileage: 0, entryMileage: 0 })).toBe(0);
    expect(validateEntryMileage({ currentMileage: 0, entryMileage: 87000 })).toBe(87000);
  });

  test.each([[-1], [10.5], ['abc'], [null], [undefined]])(
    'test_rechaza_un_kilometraje_que_no_es_entero_no_negativo_%s',
    (valor) => {
      expect(() => validateEntryMileage({ currentMileage: 0, entryMileage: valor })).toThrow(
        expect.objectContaining({ status: 400, code: 'VALIDATION_ERROR' })
      );
    }
  );
});
