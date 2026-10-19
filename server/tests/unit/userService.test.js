import bcrypt from 'bcryptjs';
import { jest } from '@jest/globals';
import { createUserService } from '../../services/userService.js';
import { createUserSchema, updateUserSchema } from '../../validators/userValidator.js';

const BASE = {
  username: 'nuevo.usuario',
  name: 'Nuevo Usuario',
  email: 'Nuevo@Taller.MX',
  role: 'MECHANIC',
  password: 'Clave2026ok',
};

function crearEntorno({ actual = null, activos = 2, ocupados = {} } = {}) {
  const modelo = {
    findById: jest.fn(async () => actual),
    findAuthByUsername: jest.fn(async (u) => (ocupados.username === u.toLowerCase() ? { id: 50 } : null)),
    findAuthByEmail: jest.fn(async (e) => (ocupados.email === e.toLowerCase() ? { id: 51 } : null)),
    countActiveAdmins: jest.fn(async () => activos),
    create: jest.fn(async (datos) => ({ id: 20, active: true, ...datos })),
    update: jest.fn(async (id, datos) => ({ ...actual, ...datos })),
    updatePasswordHash: jest.fn(async () => {}),
    resetAttempts: jest.fn(async () => {}),
    list: jest.fn(),
  };
  const servicio = createUserService({ userModel: modelo, transaction: async (trabajo) => trabajo('conexion'), bcryptCost: 4 });
  return { servicio, modelo };
}

describe('Validación de usuarios', () => {
  test('acepta_un_usuario_valido_y_normaliza_el_correo_a_minusculas', () => {
    const resultado = createUserSchema.parse(BASE);
    expect(resultado.email).toBe('nuevo@taller.mx');
    expect(resultado.username).toBe('nuevo.usuario');
  });

  test('el_nombre_de_usuario_tiene_de_3_a_50_caracteres_y_no_lleva_espacios', () => {
    expect(createUserSchema.safeParse({ ...BASE, username: 'ab' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...BASE, username: 'a'.repeat(51) }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...BASE, username: 'con espacio' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...BASE, username: 'a'.repeat(50) }).success).toBe(true);
  });

  test('exige_un_correo_con_formato_valido', () => {
    expect(createUserSchema.safeParse({ ...BASE, email: 'sin-arroba' }).success).toBe(false);
  });

  test('solo_admite_los_tres_roles_del_sistema', () => {
    for (const role of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      expect(createUserSchema.safeParse({ ...BASE, role }).success).toBe(true);
    }
    expect(createUserSchema.safeParse({ ...BASE, role: 'CLIENT' }).success).toBe(false);
  });

  test('aplica_la_politica_de_contrasena', () => {
    expect(createUserSchema.safeParse({ ...BASE, password: 'corta' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...BASE, password: 'sinnumeroAA' }).success).toBe(false);
  });

  test('la_edicion_exige_al_menos_un_campo_y_no_cambia_el_nombre_de_usuario', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ active: false }).success).toBe(true);
    expect(updateUserSchema.parse({ name: 'Otro', username: 'intruso' })).not.toHaveProperty('username');
  });
});

describe('userService.create', () => {
  test('guarda_la_contrasena_solo_como_hash_bcrypt', async () => {
    const { servicio, modelo } = crearEntorno();
    await servicio.create(createUserSchema.parse(BASE));
    const guardado = modelo.create.mock.calls[0][0];
    expect(guardado).not.toHaveProperty('password');
    expect(guardado.passwordHash).not.toBe(BASE.password);
    expect(await bcrypt.compare(BASE.password, guardado.passwordHash)).toBe(true);
  });

  test('rechaza_un_nombre_de_usuario_repetido_indicando_el_campo', async () => {
    const { servicio, modelo } = crearEntorno({ ocupados: { username: 'nuevo.usuario' } });
    const error = await servicio.create(createUserSchema.parse(BASE)).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('DUPLICATE_VALUE');
    expect(error.details).toEqual([{ field: 'username', message: expect.any(String) }]);
    expect(modelo.create).not.toHaveBeenCalled();
  });

  test('rechaza_un_correo_repetido_indicando_el_campo', async () => {
    const { servicio } = crearEntorno({ ocupados: { email: 'nuevo@taller.mx' } });
    const error = await servicio.create(createUserSchema.parse(BASE)).catch((e) => e);
    expect(error.details).toEqual([{ field: 'email', message: expect.any(String) }]);
  });
});

describe('userService.update', () => {
  const admin = { id: 1, username: 'admin', role: 'ADMIN', active: true, email: 'admin@taller.mx' };
  const mecanico = { id: 3, username: 'mecanico', role: 'MECHANIC', active: true, email: 'mec@taller.mx' };

  test('devuelve_404_si_el_usuario_no_existe', async () => {
    const { servicio } = crearEntorno({ actual: null });
    await expect(servicio.update(9, { name: 'X' })).rejects.toMatchObject({ status: 404 });
  });

  test('rechaza_desactivar_al_ultimo_administrador_activo', async () => {
    const { servicio, modelo } = crearEntorno({ actual: admin, activos: 1 });
    const error = await servicio.update(1, { active: false }).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('LAST_ADMIN');
    expect(modelo.update).not.toHaveBeenCalled();
  });

  test('rechaza_quitar_el_rol_de_administrador_al_ultimo_administrador_activo', async () => {
    const { servicio } = crearEntorno({ actual: admin, activos: 1 });
    await expect(servicio.update(1, { role: 'MECHANIC' })).rejects.toMatchObject({ code: 'LAST_ADMIN' });
  });

  test('permite_desactivar_a_un_administrador_si_hay_otro_activo', async () => {
    const { servicio, modelo } = crearEntorno({ actual: admin, activos: 2 });
    await servicio.update(1, { active: false });
    expect(modelo.update).toHaveBeenCalledWith(1, { active: false }, 'conexion');
  });

  test('no_aplica_la_regla_del_ultimo_administrador_a_otros_roles', async () => {
    const { servicio, modelo } = crearEntorno({ actual: mecanico, activos: 1 });
    await servicio.update(3, { active: false });
    expect(modelo.countActiveAdmins).not.toHaveBeenCalled();
    expect(modelo.update).toHaveBeenCalled();
  });

  test('rechaza_un_correo_que_ya_usa_otro_usuario', async () => {
    const { servicio } = crearEntorno({ actual: mecanico, ocupados: { email: 'otro@taller.mx' } });
    await expect(servicio.update(3, { email: 'otro@taller.mx' })).rejects.toMatchObject({ code: 'DUPLICATE_VALUE' });
  });

  test('restablece_la_contrasena_con_hash_y_desbloquea_la_cuenta', async () => {
    const { servicio, modelo } = crearEntorno({ actual: mecanico });
    await servicio.update(3, { password: 'Restablecida2026' });
    const [id, hash] = modelo.updatePasswordHash.mock.calls[0];
    expect(id).toBe(3);
    expect(await bcrypt.compare('Restablecida2026', hash)).toBe(true);
    expect(modelo.resetAttempts).toHaveBeenCalledWith(3, 'conexion');
    expect(modelo.update).not.toHaveBeenCalledWith(3, expect.objectContaining({ password: expect.anything() }), 'conexion');
  });
});
