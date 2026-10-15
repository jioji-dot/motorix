// Pruebas de integración de la gestión de usuarios (US2) contra la base `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { TEST_PASSWORD, createAuthenticated, createUser } from '../helpers/factories.js';

const app = createApp();

const alta = (overrides = {}) => ({
  username: 'nuevo.usuario',
  name: 'Nuevo Usuario',
  email: 'nuevo@motorix.local',
  role: 'RECEPTIONIST',
  password: 'Taller2026',
  ...overrides
});

const crear = (auth, cuerpo) => request(app).post('/api/users').set('Authorization', auth).send(cuerpo);
const editar = (auth, id, cuerpo) =>
  request(app).patch(`/api/users/${id}`).set('Authorization', auth).send(cuerpo);
const listar = (auth, query = '') => request(app).get(`/api/users${query}`).set('Authorization', auth);
const login = (identifier, password) =>
  request(app).post('/api/auth/login').send({ identifier, password });

beforeEach(cleanTables);
afterAll(closePool);

describe('alta de usuarios', () => {
  test('test_crea_un_usuario_que_luego_puede_iniciar_sesion', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await crear(auth, alta({ role: 'MECHANIC' }));

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ username: 'nuevo.usuario', role: 'MECHANIC', active: true })
    );
    const acceso = await login('nuevo.usuario', 'Taller2026');
    expect(acceso.status).toBe(200);
    expect(acceso.body.data.user.role).toBe('MECHANIC');
    expect((await login('nuevo@motorix.local', 'Taller2026')).status).toBe(200);
  });

  test('test_guarda_la_contrasena_cifrada', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await crear(auth, alta());

    const [[fila]] = await pool.query("SELECT password_hash FROM users WHERE username = 'nuevo.usuario'");

    expect(fila.password_hash).not.toContain('Taller2026');
    expect(fila.password_hash).toMatch(/^\$2[aby]\$/);
  });

  test('test_normaliza_el_correo_a_minusculas', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await crear(auth, alta({ email: ' Nuevo@Motorix.LOCAL ' }));

    expect(res.body.data.email).toBe('nuevo@motorix.local');
  });

  test('test_rechaza_un_nombre_de_usuario_repetido_sin_distinguir_mayusculas', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await createUser({ username: 'recepcion' });

    const res = await crear(auth, alta({ username: 'RECEPCION' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_USERNAME');
    expect(res.body.error.details).toEqual({ field: 'username' });
  });

  test('test_rechaza_un_correo_repetido_sin_distinguir_mayusculas', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await createUser({ email: 'ana@motorix.local' });

    const res = await crear(auth, alta({ email: 'ANA@motorix.local' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  test.each([
    ['usuario demasiado corto', { username: 'ab' }, 'username'],
    ['usuario de más de 50 caracteres', { username: 'a'.repeat(51) }, 'username'],
    ['usuario con espacios', { username: 'con espacio' }, 'username'],
    ['usuario con símbolos no permitidos', { username: 'ana@taller' }, 'username'],
    ['sin nombre', { name: '' }, 'name'],
    ['nombre de más de 100 caracteres', { name: 'a'.repeat(101) }, 'name'],
    ['correo inválido', { email: 'no-es-correo' }, 'email'],
    ['correo de más de 150 caracteres', { email: `${'a'.repeat(145)}@x.com` }, 'email'],
    ['rol inexistente', { role: 'SUPERUSER' }, 'role'],
    ['sin rol', { role: undefined }, 'role'],
    ['contraseña corta', { password: 'Ab1cdef' }, 'password'],
    ['contraseña sin mayúscula', { password: 'taller2026' }, 'password'],
    ['contraseña sin minúscula', { password: 'TALLER2026' }, 'password'],
    ['contraseña sin número', { password: 'TallerMotor' }, 'password']
  ])('test_rechaza_un_alta_con_%s', async (_nombre, cambios, campo) => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await crear(auth, alta(cambios));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });
});

describe('consulta de usuarios', () => {
  test('test_filtra_por_rol_estado_y_busqueda', async () => {
    const { auth } = await createAuthenticated('ADMIN', { username: 'admin' });
    await createUser({ username: 'recep1', name: 'Rosa Recepción', role: 'RECEPTIONIST' });
    await createUser({ username: 'meca1', name: 'Mario Mecánico', role: 'MECHANIC' });
    await createUser({ username: 'meca2', name: 'Marta Mecánica', role: 'MECHANIC', active: false });

    const porRol = await listar(auth, '?role=MECHANIC');
    const activos = await listar(auth, '?active=true');
    const inactivos = await listar(auth, '?active=false');
    const porTexto = await listar(auth, '?search=rosa');

    expect(porRol.body.data.map((u) => u.username).sort()).toEqual(['meca1', 'meca2']);
    expect(activos.body.meta.total).toBe(3);
    expect(inactivos.body.data.map((u) => u.username)).toEqual(['meca2']);
    expect(porTexto.body.data.map((u) => u.username)).toEqual(['recep1']);
  });

  test('test_pagina_el_listado', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    for (let i = 0; i < 14; i += 1) await createUser();

    const res = await listar(auth, '?page=2&pageSize=10');

    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 10, total: 15 });
  });

  test('test_un_usuario_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/users/9999').set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('edición de usuarios', () => {
  test('test_el_cambio_de_rol_aplica_de_inmediato', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createAuthenticated('RECEPTIONIST');

    const res = await editar(auth, otro.user.id, { role: 'MECHANIC' });

    expect(res.status).toBe(200);
    const perfil = await request(app).get('/api/auth/me').set('Authorization', otro.auth);
    expect(perfil.body.data.role).toBe('MECHANIC');
    expect((await request(app).post('/api/clients').set('Authorization', otro.auth).send({
      name: 'Ana', phone: '5512345678'
    })).status).toBe(403);
  });

  test('test_un_usuario_desactivado_ya_no_puede_iniciar_sesion_ni_usar_su_token', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createAuthenticated('RECEPTIONIST', { username: 'recepcion' });

    const res = await editar(auth, otro.user.id, { active: false });

    expect(res.body.data.active).toBe(false);
    expect((await login('recepcion', TEST_PASSWORD)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', otro.auth)).status).toBe(401);
  });

  test('test_reactivar_un_usuario_le_devuelve_el_acceso', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser({ username: 'recepcion', active: false });

    await editar(auth, otro.id, { active: true });

    expect((await login('recepcion', TEST_PASSWORD)).status).toBe(200);
  });

  test('test_edita_nombre_y_correo', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser();

    const res = await editar(auth, otro.id, { name: 'Nombre Nuevo', email: 'Otro@Motorix.local' });

    expect(res.body.data).toEqual(expect.objectContaining({ name: 'Nombre Nuevo', email: 'otro@motorix.local' }));
  });

  test('test_el_nombre_de_usuario_no_se_puede_modificar', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser({ username: 'original' });

    const res = await editar(auth, otro.id, { username: 'cambiado' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('username');
    const [[fila]] = await pool.query('SELECT username FROM users WHERE id = ?', [otro.id]);
    expect(fila.username).toBe('original');
  });

  test('test_rechaza_un_correo_ya_usado_por_otro_usuario', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await createUser({ email: 'ocupado@motorix.local' });
    const otro = await createUser();

    const res = await editar(auth, otro.id, { email: 'OCUPADO@motorix.local' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  test('test_una_edicion_vacia_o_con_rol_invalido_responde_400', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser();

    expect((await editar(auth, otro.id, {})).status).toBe(400);
    expect((await editar(auth, otro.id, { role: 'SUPERUSER' })).status).toBe(400);
  });

  test('test_editar_un_usuario_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    expect((await editar(auth, 9999, { name: 'Nadie' })).status).toBe(404);
  });
});

describe('protección del último administrador', () => {
  test('test_no_permite_desactivar_a_la_unica_cuenta_de_administrador_activa', async () => {
    const { user, auth } = await createAuthenticated('ADMIN');

    const res = await editar(auth, user.id, { active: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN_PROTECTED');
    const [[fila]] = await pool.query('SELECT active FROM users WHERE id = ?', [user.id]);
    expect(fila.active).toBe(1);
  });

  test('test_no_permite_quitarse_el_rol_de_administrador_a_si_mismo', async () => {
    const { user, auth } = await createAuthenticated('ADMIN');

    const res = await editar(auth, user.id, { role: 'RECEPTIONIST' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN_PROTECTED');
  });

  test('test_un_administrador_no_puede_desactivarse_ni_cambiar_su_rol_aunque_haya_otros', async () => {
    const { user, auth } = await createAuthenticated('ADMIN');
    await createUser({ role: 'ADMIN' });

    expect((await editar(auth, user.id, { active: false })).status).toBe(409);
    expect((await editar(auth, user.id, { role: 'MECHANIC' })).status).toBe(409);
  });

  test('test_permite_editar_el_propio_nombre_sin_tocar_rol_ni_estado', async () => {
    const { user, auth } = await createAuthenticated('ADMIN');

    const res = await editar(auth, user.id, { name: 'Nuevo Nombre', role: 'ADMIN', active: true });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Nuevo Nombre');
  });

  test('test_permite_desactivar_a_otro_administrador_mientras_quede_uno_activo', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser({ role: 'ADMIN' });

    const res = await editar(auth, otro.id, { active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  test('test_no_permite_que_un_administrador_deje_al_sistema_sin_administradores_activos', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const segundo = await createUser({ role: 'ADMIN' });
    await editar(auth, segundo.id, { active: false });

    // Solo queda la cuenta del administrador actual: no puede desactivarla ni degradarla.
    const [[actual]] = await pool.query("SELECT id FROM users WHERE role = 'ADMIN' AND active = 1");
    expect((await editar(auth, actual.id, { active: false })).status).toBe(409);
    expect((await editar(auth, actual.id, { role: 'MECHANIC' })).status).toBe(409);
  });
});

describe('restablecimiento de contraseña', () => {
  const restablecer = (auth, id, newPassword) =>
    request(app).post(`/api/users/${id}/reset-password`).set('Authorization', auth).send({ newPassword });

  test('test_el_administrador_restablece_la_contrasena_y_el_usuario_entra_con_la_nueva', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser({ username: 'olvidadizo' });

    const res = await restablecer(auth, otro.id, 'Nueva2026Clave');

    expect(res.status).toBe(204);
    expect((await login('olvidadizo', 'Nueva2026Clave')).status).toBe(200);
    expect((await login('olvidadizo', TEST_PASSWORD)).status).toBe(401);
  });

  test('test_rechaza_una_contrasena_que_no_cumple_la_politica', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser();

    for (const mala of ['corta1A', 'sinnumeroAA', 'SINMINUSCULA1', 'sinmayuscula1']) {
      const res = await restablecer(auth, otro.id, mala);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('test_restablecer_la_contrasena_desbloquea_la_cuenta', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser({ username: 'bloqueado' });
    for (let i = 0; i < 5; i += 1) await login('bloqueado', 'Incorrecta1');
    expect((await login('bloqueado', TEST_PASSWORD)).status).toBe(423);

    await restablecer(auth, otro.id, 'Nueva2026Clave');

    expect((await login('bloqueado', 'Nueva2026Clave')).status).toBe(200);
  });

  test('test_restablecer_la_contrasena_de_un_usuario_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    expect((await restablecer(auth, 9999, 'Nueva2026Clave')).status).toBe(404);
  });
});

describe('permisos', () => {
  test.each(['RECEPTIONIST', 'MECHANIC'])('test_el_rol_%s_no_puede_gestionar_usuarios', async (role) => {
    const { auth } = await createAuthenticated(role);
    const otro = await createUser();

    const respuestas = [
      await listar(auth),
      await crear(auth, alta()),
      await request(app).get(`/api/users/${otro.id}`).set('Authorization', auth),
      await editar(auth, otro.id, { name: 'X' }),
      await request(app).post(`/api/users/${otro.id}/reset-password`).set('Authorization', auth).send({ newPassword: 'Nueva2026Clave' })
    ];

    for (const res of respuestas) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  test('test_exige_sesion_en_todas_las_rutas_de_usuarios', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
    expect((await request(app).post('/api/users').send(alta())).status).toBe(401);
    expect((await request(app).patch('/api/users/1').send({ name: 'X' })).status).toBe(401);
  });

  test('test_ninguna_respuesta_incluye_datos_de_contrasena', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser();

    const lista = await listar(auth);
    const detalle = await request(app).get(`/api/users/${otro.id}`).set('Authorization', auth);
    const edicion = await editar(auth, otro.id, { name: 'Otro Nombre' });

    for (const res of [lista, detalle, edicion]) {
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash|failed_login|lockedUntil/i);
    }
  });
});
