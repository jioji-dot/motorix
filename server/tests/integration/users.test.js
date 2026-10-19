import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

const NUEVO = {
  username: 'mecanico2',
  name: 'Segundo Mecánico',
  email: 'mecanico2@motorix.test',
  role: 'MECHANIC',
  password: 'Taller2026ok',
};

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

const login = (identifier, password) => request(app).post('/api/auth/login').send({ identifier, password });

describe('Usuarios (integración)', () => {
  test.each(['RECEPTIONIST', 'MECHANIC'])('el_rol_%s_recibe_403_en_todas_las_rutas_de_usuarios', async (rol) => {
    expect((await request(app).get('/api/users').set(como(rol))).status).toBe(403);
    expect((await request(app).get(`/api/users/${usuarios.ADMIN.id}`).set(como(rol))).status).toBe(403);
    expect((await request(app).post('/api/users').set(como(rol)).send(NUEVO)).status).toBe(403);
    expect((await request(app).patch(`/api/users/${usuarios.ADMIN.id}`).set(como(rol)).send({ name: 'X' })).status).toBe(403);
  });

  test('rechaza_peticiones_sin_token', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });

  test('el_administrador_crea_un_usuario_que_puede_iniciar_sesion_con_su_rol', async () => {
    const alta = await request(app).post('/api/users').set(como('ADMIN')).send(NUEVO);
    expect(alta.status).toBe(201);
    expect(alta.body.data).toMatchObject({ username: 'mecanico2', role: 'MECHANIC', active: true });
    expect(alta.body.data).not.toHaveProperty('passwordHash');

    const entrada = await login('mecanico2', NUEVO.password);
    expect(entrada.status).toBe(200);
    expect(entrada.body.data.user.role).toBe('MECHANIC');
    expect((await login('MECANICO2@MOTORIX.TEST', NUEVO.password)).status).toBe(200);
  });

  test('rechaza_usuario_o_correo_duplicados_sin_distinguir_mayusculas', async () => {
    const usuarioRepetido = await request(app)
      .post('/api/users')
      .set(como('ADMIN'))
      .send({ ...NUEVO, username: 'MECANICO2', email: 'otro@motorix.test' });
    expect(usuarioRepetido.status).toBe(409);
    expect(usuarioRepetido.body.error.details[0].field).toBe('username');

    const correoRepetido = await request(app)
      .post('/api/users')
      .set(como('ADMIN'))
      .send({ ...NUEVO, username: 'otro.usuario', email: 'MECANICO2@motorix.test' });
    expect(correoRepetido.status).toBe(409);
    expect(correoRepetido.body.error.details[0].field).toBe('email');
  });

  test('rechaza_una_contrasena_que_no_cumple_la_politica', async () => {
    const respuesta = await request(app)
      .post('/api/users')
      .set(como('ADMIN'))
      .send({ ...NUEVO, username: 'debil', email: 'debil@motorix.test', password: 'abc' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details.map((d) => d.field)).toContain('password');
  });

  test('lista_con_filtros_y_nunca_devuelve_el_hash', async () => {
    const lista = await request(app).get('/api/users?role=MECHANIC&search=mecanico').set(como('ADMIN'));
    expect(lista.status).toBe(200);
    expect(lista.body.data.map((u) => u.username).sort()).toEqual(['mecanico', 'mecanico2']);
    expect(JSON.stringify(lista.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(lista.body.meta.total).toBe(2);
  });

  test('un_cambio_de_rol_surte_efecto_en_la_siguiente_peticion_sin_esperar_la_expiracion', async () => {
    const intento1 = await request(app)
      .post('/api/clients')
      .set(como('MECHANIC'))
      .send({ name: 'Cliente por rol', phone: '5500009999' });
    expect(intento1.status).toBe(403);

    const cambio = await request(app)
      .patch(`/api/users/${usuarios.MECHANIC.id}`)
      .set(como('ADMIN'))
      .send({ role: 'RECEPTIONIST' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.data.role).toBe('RECEPTIONIST');

    // El mismo token del usuario ya tiene el rol nuevo.
    const intento2 = await request(app)
      .post('/api/clients')
      .set(como('MECHANIC'))
      .send({ name: 'Cliente por rol', phone: '5500009999' });
    expect(intento2.status).toBe(201);
  });

  test('desactivar_un_usuario_le_impide_seguir_usando_su_token_y_volver_a_entrar', async () => {
    const baja = await request(app)
      .patch(`/api/users/${usuarios.RECEPTIONIST.id}`)
      .set(como('ADMIN'))
      .send({ active: false });
    expect(baja.status).toBe(200);
    expect(baja.body.data.active).toBe(false);

    const conToken = await request(app).get('/api/clients').set(como('RECEPTIONIST'));
    expect(conToken.status).toBe(403);
    expect(conToken.body.error.code).toBe('ACCOUNT_DISABLED');
    expect((await login('recepcion', 'Prueba2026!')).status).toBe(403);

    const alta = await request(app)
      .patch(`/api/users/${usuarios.RECEPTIONIST.id}`)
      .set(como('ADMIN'))
      .send({ active: true });
    expect(alta.body.data.active).toBe(true);
    expect((await request(app).get('/api/clients').set(como('RECEPTIONIST'))).status).toBe(200);
  });

  test('el_administrador_restablece_la_contrasena_de_otro_usuario', async () => {
    const cambio = await request(app)
      .patch(`/api/users/${usuarios.RECEPTIONIST.id}`)
      .set(como('ADMIN'))
      .send({ password: 'Restablecida2026' });
    expect(cambio.status).toBe(200);
    expect((await login('recepcion', 'Prueba2026!')).status).toBe(401);
    expect((await login('recepcion', 'Restablecida2026')).status).toBe(200);
  });

  test('impide_dejar_al_taller_sin_administrador_activo', async () => {
    const desactivar = await request(app)
      .patch(`/api/users/${usuarios.ADMIN.id}`)
      .set(como('ADMIN'))
      .send({ active: false });
    expect(desactivar.status).toBe(409);
    expect(desactivar.body.error.code).toBe('LAST_ADMIN');

    const quitarRol = await request(app)
      .patch(`/api/users/${usuarios.ADMIN.id}`)
      .set(como('ADMIN'))
      .send({ role: 'MECHANIC' });
    expect(quitarRol.status).toBe(409);
    expect(quitarRol.body.error.code).toBe('LAST_ADMIN');

    // El administrador sigue activo y con su rol.
    const yo = await request(app).get(`/api/users/${usuarios.ADMIN.id}`).set(como('ADMIN'));
    expect(yo.body.data).toMatchObject({ role: 'ADMIN', active: true });
  });

  test('con_un_segundo_administrador_activo_ya_se_puede_desactivar_al_primero', async () => {
    const segundo = await request(app)
      .post('/api/users')
      .set(como('ADMIN'))
      .send({ username: 'admin2', name: 'Otro Admin', email: 'admin2@motorix.test', role: 'ADMIN', password: 'Admin2Seg2026' });
    expect(segundo.status).toBe(201);

    const desactivar = await request(app)
      .patch(`/api/users/${usuarios.ADMIN.id}`)
      .set(como('ADMIN'))
      .send({ active: false });
    expect(desactivar.status).toBe(200);

    // Ahora el único activo es admin2: ya no puede desactivarse.
    const tokenAdmin2 = (await login('admin2', 'Admin2Seg2026')).body.data.token;
    const bloqueado = await request(app)
      .patch(`/api/users/${segundo.body.data.id}`)
      .set({ Authorization: `Bearer ${tokenAdmin2}` })
      .send({ active: false });
    expect(bloqueado.status).toBe(409);
  });

  test('devuelve_404_para_un_usuario_inexistente_y_400_para_un_id_invalido', async () => {
    const tokenAdmin2 = (await login('admin2', 'Admin2Seg2026')).body.data.token;
    const auth = { Authorization: `Bearer ${tokenAdmin2}` };
    expect((await request(app).get('/api/users/999999').set(auth)).status).toBe(404);
    expect((await request(app).get('/api/users/abc').set(auth)).status).toBe(400);
  });
});
