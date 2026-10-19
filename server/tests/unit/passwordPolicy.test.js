import { passwordSchema } from '../../validators/authValidator.js';

describe('Política de contraseñas', () => {
  const valida = (valor) => passwordSchema.safeParse(valor).success;

  test('acepta_contrasena_con_8_caracteres_mayuscula_minuscula_y_numero', () => {
    expect(valida('Abcdef12')).toBe(true);
    expect(valida('Clave2026!')).toBe(true);
  });

  test('rechaza_contrasena_de_menos_de_8_caracteres', () => {
    expect(valida('Abc1234')).toBe(false);
  });

  test('rechaza_contrasena_sin_mayuscula', () => {
    expect(valida('abcdefg1')).toBe(false);
  });

  test('rechaza_contrasena_sin_minuscula', () => {
    expect(valida('ABCDEFG1')).toBe(false);
  });

  test('rechaza_contrasena_sin_numero', () => {
    expect(valida('Abcdefgh')).toBe(false);
  });

  test('indica_en_espanol_que_requisitos_faltan', () => {
    const resultado = passwordSchema.safeParse('abc');
    const mensajes = resultado.error.issues.map((problema) => problema.message).join(' ');
    expect(mensajes).toMatch(/8 caracteres/);
    expect(mensajes).toMatch(/mayúscula/);
    expect(mensajes).toMatch(/número/);
  });
});
