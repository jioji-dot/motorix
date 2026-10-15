import { comparePassword, hashPassword, isPasswordValid } from '../../utils/password.js';

describe('política de contraseñas', () => {
  test('test_acepta_una_contrasena_que_cumple_la_politica', () => {
    expect(isPasswordValid('Taller2026')).toBe(true);
  });

  test('test_rechaza_contrasena_con_menos_de_8_caracteres', () => {
    expect(isPasswordValid('Ab1cdef')).toBe(false);
  });

  test('test_rechaza_contrasena_sin_mayuscula', () => {
    expect(isPasswordValid('taller2026')).toBe(false);
  });

  test('test_rechaza_contrasena_sin_minuscula', () => {
    expect(isPasswordValid('TALLER2026')).toBe(false);
  });

  test('test_rechaza_contrasena_sin_numero', () => {
    expect(isPasswordValid('TallerMotor')).toBe(false);
  });

  test('test_rechaza_valores_que_no_son_texto', () => {
    expect(isPasswordValid(undefined)).toBe(false);
    expect(isPasswordValid(12345678)).toBe(false);
  });

  test('test_cifra_con_bcrypt_y_nunca_guarda_texto_plano', async () => {
    const hash = await hashPassword('Taller2026');
    expect(hash).not.toContain('Taller2026');
    expect(await comparePassword('Taller2026', hash)).toBe(true);
    expect(await comparePassword('Otra2026x', hash)).toBe(false);
  });
});
