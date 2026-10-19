import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { createAuthService } from '../../services/authService.js';

const HASH = bcrypt.hashSync('Correcta2026!', 4);
const AHORA = new Date('2026-10-19T12:00:00Z');

function crearEntorno(usuarioBase = {}) {
  const usuario = {
    id: 7,
    username: 'recepcion',
    name: 'Recepción',
    email: 'recepcion@taller.mx',
    role: 'RECEPTIONIST',
    active: 1,
    passwordHash: HASH,
    failedAttempts: 0,
    lockedUntil: null,
    ...usuarioBase,
  };
  const modelo = {
    consultas: [],
    findAuthByUsername: jest.fn(async (valor) => {
      modelo.consultas.push(['username', valor]);
      return valor === usuario.username ? { ...usuario } : null;
    }),
    findAuthByEmail: jest.fn(async (valor) => {
      modelo.consultas.push(['email', valor]);
      return valor === usuario.email ? { ...usuario } : null;
    }),
    registerFailedAttempt: jest.fn(async () => {}),
    lockAccount: jest.fn(async () => {}),
    resetAttempts: jest.fn(async () => {}),
    updatePasswordHash: jest.fn(async () => {}),
    findAuthById: jest.fn(async () => ({ ...usuario })),
  };
  const servicio = createAuthService({
    userModel: modelo,
    now: () => AHORA,
    jwtSecret: 'secreto',
    jwtExpiresIn: '8h',
    bcryptCost: 4,
  });
  return { servicio, modelo, usuario };
}

describe('authService.login', () => {
  test('busca_por_correo_cuando_el_identificador_contiene_arroba', async () => {
    const { servicio, modelo } = crearEntorno();
    await servicio.login('recepcion@taller.mx', 'Correcta2026!');
    expect(modelo.consultas).toEqual([['email', 'recepcion@taller.mx']]);
  });

  test('busca_por_usuario_cuando_el_identificador_no_contiene_arroba', async () => {
    const { servicio, modelo } = crearEntorno();
    await servicio.login('recepcion', 'Correcta2026!');
    expect(modelo.consultas).toEqual([['username', 'recepcion']]);
  });

  test('ignora_mayusculas_y_espacios_al_inicio_y_al_final_del_identificador', async () => {
    const { servicio } = crearEntorno();
    const resultado = await servicio.login('  RECEPCION  ', 'Correcta2026!');
    expect(resultado.user.username).toBe('recepcion');
  });

  test('devuelve_token_de_8_horas_y_datos_publicos_sin_hash', async () => {
    const { servicio } = crearEntorno();
    const resultado = await servicio.login('recepcion', 'Correcta2026!');
    expect(typeof resultado.token).toBe('string');
    expect(resultado.expiresIn).toBe(28800);
    expect(resultado.user).toEqual({
      id: 7,
      username: 'recepcion',
      name: 'Recepción',
      email: 'recepcion@taller.mx',
      role: 'RECEPTIONIST',
    });
    expect(JSON.stringify(resultado)).not.toMatch(/passwordHash/);
  });

  test('reinicia_el_contador_de_intentos_al_acertar', async () => {
    const { servicio, modelo } = crearEntorno({ failedAttempts: 3 });
    await servicio.login('recepcion', 'Correcta2026!');
    expect(modelo.resetAttempts).toHaveBeenCalledWith(7);
  });

  test('responde_con_mensaje_generico_si_el_usuario_no_existe', async () => {
    const { servicio } = crearEntorno();
    await expect(servicio.login('nadie', 'Correcta2026!')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  test('responde_con_el_mismo_mensaje_si_la_contrasena_es_incorrecta', async () => {
    const { servicio } = crearEntorno();
    const errorUsuario = await servicio.login('nadie', 'x').catch((e) => e);
    const errorClave = await servicio.login('recepcion', 'Incorrecta1').catch((e) => e);
    expect(errorClave.code).toBe('INVALID_CREDENTIALS');
    expect(errorClave.message).toBe(errorUsuario.message);
  });

  test('registra_el_intento_fallido_sin_bloquear_antes_del_quinto', async () => {
    const { servicio, modelo } = crearEntorno({ failedAttempts: 3 });
    await servicio.login('recepcion', 'Incorrecta1').catch(() => {});
    expect(modelo.registerFailedAttempt).toHaveBeenCalledWith(7);
    expect(modelo.lockAccount).not.toHaveBeenCalled();
  });

  test('bloquea_la_cuenta_15_minutos_al_llegar_al_quinto_intento_fallido', async () => {
    const { servicio, modelo } = crearEntorno({ failedAttempts: 4 });
    await expect(servicio.login('recepcion', 'Incorrecta1')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(modelo.lockAccount).toHaveBeenCalledTimes(1);
    const [id, hasta] = modelo.lockAccount.mock.calls[0];
    expect(id).toBe(7);
    expect(hasta.getTime() - AHORA.getTime()).toBe(15 * 60 * 1000);
  });

  test('rechaza_con_423_y_tiempo_restante_si_la_cuenta_esta_bloqueada', async () => {
    const { servicio } = crearEntorno({ lockedUntil: new Date(AHORA.getTime() + 10 * 60 * 1000) });
    const error = await servicio.login('recepcion', 'Correcta2026!').catch((e) => e);
    expect(error.status).toBe(423);
    expect(error.code).toBe('ACCOUNT_LOCKED');
    expect(error.extra.retryAfterSeconds).toBe(600);
    expect(error.message).toMatch(/10 minutos/);
  });

  test('permite_entrar_cuando_el_bloqueo_ya_vencio', async () => {
    const { servicio } = crearEntorno({ lockedUntil: new Date(AHORA.getTime() - 1000) });
    const resultado = await servicio.login('recepcion', 'Correcta2026!');
    expect(resultado.user.username).toBe('recepcion');
  });

  test('rechaza_cuentas_desactivadas_con_403_solo_si_la_contrasena_es_correcta', async () => {
    const { servicio } = crearEntorno({ active: 0 });
    await expect(servicio.login('recepcion', 'Correcta2026!')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_DISABLED',
    });
    await expect(servicio.login('recepcion', 'Incorrecta1')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('authService.changePassword', () => {
  test('actualiza_el_hash_cuando_la_contrasena_actual_es_correcta', async () => {
    const { servicio, modelo } = crearEntorno();
    await servicio.changePassword(7, 'Correcta2026!', 'NuevaClave2026');
    expect(modelo.updatePasswordHash).toHaveBeenCalledTimes(1);
    const [id, hash] = modelo.updatePasswordHash.mock.calls[0];
    expect(id).toBe(7);
    expect(await bcrypt.compare('NuevaClave2026', hash)).toBe(true);
  });

  test('rechaza_el_cambio_si_la_contrasena_actual_es_incorrecta', async () => {
    const { servicio, modelo } = crearEntorno();
    await expect(servicio.changePassword(7, 'Incorrecta1', 'NuevaClave2026')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(modelo.updatePasswordHash).not.toHaveBeenCalled();
  });
});
