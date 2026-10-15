// Pruebas de integración de clientes (US3 y US4) contra la base `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createClient, createVehicle } from '../helpers/factories.js';

const app = createApp();

const crear = (auth, cuerpo) => request(app).post('/api/clients').set('Authorization', auth).send(cuerpo);
const listar = (auth, query = '') => request(app).get(`/api/clients${query}`).set('Authorization', auth);

beforeEach(cleanTables);
afterAll(closePool);

describe('alta de clientes', () => {
  test('test_registra_un_cliente_con_los_datos_obligatorios', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await crear(auth, { name: '  Ana Pérez  ', phone: '5512345678' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ name: 'Ana Pérez', phone: '5512345678', email: null, address: null })
    );
    const lista = await listar(auth);
    expect(lista.body.data).toHaveLength(1);
  });

  test('test_registra_correo_y_direccion_opcionales_y_normaliza_el_correo', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await crear(auth, {
      name: 'Luis Gómez',
      phone: '+52 55 1234-5678',
      email: '  Luis@Correo.COM ',
      address: 'Calle 1 #23'
    });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('luis@correo.com');
    expect(res.body.data.address).toBe('Calle 1 #23');
    expect(res.body.data.phone).toBe('+52 55 1234-5678');
  });

  test('test_trata_el_correo_vacio_como_ausente', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await crear(auth, { name: 'Sin correo', phone: '5512345678', email: '', address: '' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBeNull();
    expect(res.body.data.address).toBeNull();
  });

  test.each([
    ['sin nombre', { phone: '5512345678' }, 'name'],
    ['con nombre vacío', { name: '   ', phone: '5512345678' }, 'name'],
    ['con nombre de más de 120 caracteres', { name: 'a'.repeat(121), phone: '5512345678' }, 'name'],
    ['sin teléfono', { name: 'Ana' }, 'phone'],
    ['con teléfono demasiado corto', { name: 'Ana', phone: '12345' }, 'phone'],
    ['con teléfono demasiado largo', { name: 'Ana', phone: '1234567890123456' }, 'phone'],
    ['con teléfono con letras', { name: 'Ana', phone: '55abc12345' }, 'phone'],
    ['con correo inválido', { name: 'Ana', phone: '5512345678', email: 'no-es-correo' }, 'email'],
    [
      'con dirección de más de 255 caracteres',
      { name: 'Ana', phone: '5512345678', address: 'a'.repeat(256) },
      'address'
    ]
  ])('test_rechaza_un_alta_%s', async (_nombre, cuerpo, campo) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await crear(auth, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });

  test('test_el_mecanico_no_puede_registrar_clientes', async () => {
    const { auth } = await createAuthenticated('MECHANIC');

    const res = await crear(auth, { name: 'Ana', phone: '5512345678' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('test_exige_sesion_para_registrar_o_consultar_clientes', async () => {
    expect((await request(app).post('/api/clients').send({ name: 'Ana', phone: '5512345678' })).status).toBe(401);
    expect((await request(app).get('/api/clients')).status).toBe(401);
    expect((await request(app).get('/api/clients/1')).status).toBe(401);
  });
});

describe('teléfono duplicado', () => {
  test('test_advierte_con_409_cuando_el_telefono_ya_existe', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const existente = await createClient({ name: 'Ana Pérez', phone: '5512345678' });

    const res = await crear(auth, { name: 'Otra Persona', phone: '5512345678' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_DUPLICATE_WARNING');
    expect(res.body.error.details.matches).toEqual([{ id: existente.id, name: 'Ana Pérez' }]);
    expect((await listar(auth)).body.meta.total).toBe(1);
  });

  test('test_compara_los_telefonos_ignorando_espacios_guiones_y_el_signo_mas', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez', phone: '5512345678' });

    const res = await crear(auth, { name: 'Otra', phone: '55 1234-5678' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_DUPLICATE_WARNING');
  });

  test('test_guarda_el_cliente_cuando_se_confirma_el_telefono_duplicado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ phone: '5512345678' });

    const res = await crear(auth, {
      name: 'Otra Persona',
      phone: '5512345678',
      confirmDuplicatePhone: true
    });

    expect(res.status).toBe(201);
    expect((await listar(auth)).body.meta.total).toBe(2);
  });
});

describe('edición de clientes', () => {
  const editar = (auth, id, cuerpo) =>
    request(app).patch(`/api/clients/${id}`).set('Authorization', auth).send(cuerpo);
  const detalle = (auth, id) => request(app).get(`/api/clients/${id}`).set('Authorization', auth);

  test('test_el_cambio_se_ve_en_el_listado_y_en_el_detalle', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5511111111' });

    const res = await editar(auth, cliente.id, { phone: '5522222222', name: 'Ana P. Gómez' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ name: 'Ana P. Gómez', phone: '5522222222' }));
    expect((await detalle(auth, cliente.id)).body.data.phone).toBe('5522222222');
    expect((await listar(auth, '?search=5522')).body.data.map((c) => c.name)).toEqual(['Ana P. Gómez']);
    expect((await listar(auth, '?search=5511')).body.data).toEqual([]);
  });

  test('test_una_edicion_parcial_conserva_los_demas_datos', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const cliente = await createClient({
      name: 'Ana Pérez',
      phone: '5511111111',
      email: 'ana@correo.com',
      address: 'Calle 1'
    });

    const res = await editar(auth, cliente.id, { name: 'Ana Pérez López' });

    expect(res.body.data).toEqual(
      expect.objectContaining({
        name: 'Ana Pérez López',
        phone: '5511111111',
        email: 'ana@correo.com',
        address: 'Calle 1'
      })
    );
  });

  test('test_permite_borrar_el_correo_y_la_direccion_enviando_vacio_o_null', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const cliente = await createClient({ email: 'ana@correo.com', address: 'Calle 1' });

    const res = await editar(auth, cliente.id, { email: '', address: null });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBeNull();
    expect(res.body.data.address).toBeNull();
  });

  test('test_los_datos_invalidos_se_rechazan_y_se_conservan_los_anteriores', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5511111111' });

    for (const invalido of [
      { name: '   ' },
      { phone: '123' },
      { phone: 'abc1234567' },
      { email: 'sin-arroba' },
      { name: 'a'.repeat(121) }
    ]) {
      const res = await editar(auth, cliente.id, invalido);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const actual = (await detalle(auth, cliente.id)).body.data;
    expect(actual.name).toBe('Ana Pérez');
    expect(actual.phone).toBe('5511111111');
  });

  test('test_una_edicion_vacia_responde_400', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const res = await editar(auth, cliente.id, {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('test_editar_un_cliente_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await editar(auth, 9999, { name: 'Nadie' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('test_el_mecanico_no_puede_editar_clientes', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const cliente = await createClient({ name: 'Ana Pérez' });

    const res = await editar(auth, cliente.id, { name: 'Otro Nombre' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const admin = await createAuthenticated('ADMIN');
    expect((await detalle(admin.auth, cliente.id)).body.data.name).toBe('Ana Pérez');
  });

  test('test_exige_sesion_para_editar_clientes', async () => {
    const cliente = await createClient();

    const res = await request(app).patch(`/api/clients/${cliente.id}`).send({ name: 'X' });

    expect(res.status).toBe(401);
  });

  test('test_advierte_al_cambiar_a_un_telefono_que_ya_tiene_otro_cliente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Marta Ruiz', phone: '5533333333' });
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5511111111' });

    const res = await editar(auth, cliente.id, { phone: '55 3333-3333' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_DUPLICATE_WARNING');
    expect(res.body.error.details.matches.map((m) => m.name)).toEqual(['Marta Ruiz']);
    expect((await detalle(auth, cliente.id)).body.data.phone).toBe('5511111111');
  });

  test('test_guarda_el_telefono_repetido_cuando_se_confirma', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Marta Ruiz', phone: '5533333333' });
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5511111111' });

    const res = await editar(auth, cliente.id, { phone: '5533333333', confirmDuplicatePhone: true });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('5533333333');
  });

  test('test_no_advierte_cuando_el_telefono_no_cambia_aunque_haya_otro_cliente_con_el_mismo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Marta Ruiz', phone: '5533333333' });
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5533333333' });

    const mismoTelefono = await editar(auth, cliente.id, { phone: '5533333333', name: 'Ana P.' });
    const otroFormato = await editar(auth, cliente.id, { phone: '55 3333 3333' });

    expect(mismoTelefono.status).toBe(200);
    expect(otroFormato.status).toBe(200);
  });

  test('test_no_se_compara_el_telefono_del_propio_cliente_al_editar_otros_datos', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient({ phone: '5511111111' });

    const res = await editar(auth, cliente.id, { phone: '5511111111', address: 'Calle 2' });

    expect(res.status).toBe(200);
  });
});

describe('consulta de clientes', () => {
  test('test_busca_por_nombre_telefono_y_correo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez', phone: '5511111111', email: 'ana@taller.com' });
    await createClient({ name: 'Luis Gómez', phone: '5522222222', email: 'luis@correo.com' });
    await createClient({ name: 'María López', phone: '5533333333' });

    const porNombre = await listar(auth, '?search=gómez');
    const porTelefono = await listar(auth, '?search=5533');
    const porCorreo = await listar(auth, '?search=ana@taller');
    const sinResultados = await listar(auth, '?search=zzz');

    expect(porNombre.body.data.map((c) => c.name)).toEqual(['Luis Gómez']);
    expect(porTelefono.body.data.map((c) => c.name)).toEqual(['María López']);
    expect(porCorreo.body.data.map((c) => c.name)).toEqual(['Ana Pérez']);
    expect(sinResultados.body.data).toEqual([]);
    expect(sinResultados.body.meta.total).toBe(0);
  });

  test('test_la_busqueda_trata_los_comodines_de_like_como_texto_literal', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez' });

    const res = await listar(auth, '?search=%25');

    expect(res.body.data).toEqual([]);
  });

  test('test_pagina_los_resultados_con_20_por_defecto_y_maximo_100', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    for (let i = 1; i <= 25; i += 1) {
      await createClient({ name: `Cliente ${String(i).padStart(2, '0')}` });
    }

    const primera = await listar(auth);
    const segunda = await listar(auth, '?page=2&pageSize=10');
    const enorme = await listar(auth, '?pageSize=500');

    expect(primera.body.data).toHaveLength(20);
    expect(primera.body.meta).toEqual({ page: 1, pageSize: 20, total: 25 });
    expect(segunda.body.data).toHaveLength(10);
    expect(segunda.body.meta).toEqual({ page: 2, pageSize: 10, total: 25 });
    expect(enorme.body.meta.pageSize).toBe(100);
    expect(enorme.body.data).toHaveLength(25);
  });

  test('test_ordena_el_listado_por_nombre', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Zoe' });
    await createClient({ name: 'Ana' });

    const res = await listar(auth);

    expect(res.body.data.map((c) => c.name)).toEqual(['Ana', 'Zoe']);
  });

  test('test_el_detalle_incluye_los_vehiculos_asociados', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const cliente = await createClient({ name: 'Ana Pérez' });
    const otro = await createClient({ name: 'Otro' });
    await createVehicle(cliente.id, { licensePlate: 'AAA111' });
    await createVehicle(cliente.id, { licensePlate: 'BBB222' });
    await createVehicle(otro.id, { licensePlate: 'CCC333' });

    const res = await request(app).get(`/api/clients/${cliente.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Ana Pérez');
    expect(res.body.data.vehicles.map((v) => v.licensePlate).sort()).toEqual(['AAA111', 'BBB222']);
  });

  test('test_un_cliente_sin_vehiculos_devuelve_un_arreglo_vacio', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const res = await request(app).get(`/api/clients/${cliente.id}`).set('Authorization', auth);

    expect(res.body.data.vehicles).toEqual([]);
  });

  test('test_los_tres_roles_pueden_consultar_clientes', async () => {
    const cliente = await createClient();
    for (const role of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const { auth } = await createAuthenticated(role);
      expect((await listar(auth)).status).toBe(200);
      expect((await request(app).get(`/api/clients/${cliente.id}`).set('Authorization', auth)).status).toBe(200);
    }
  });

  test('test_un_cliente_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/clients/9999').set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('test_un_identificador_no_numerico_responde_400', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/clients/abc').set('Authorization', auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
