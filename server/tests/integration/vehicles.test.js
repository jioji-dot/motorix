// Pruebas de integración de vehículos (US5) contra la base `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createClient, createVehicle } from '../helpers/factories.js';

const app = createApp();

const valido = (clientId, extra = {}) => ({
  clientId,
  brand: 'Toyota',
  model: 'Corolla',
  year: 2021,
  licensePlate: 'XYZ987',
  ...extra
});

const crear = (auth, cuerpo) => request(app).post('/api/vehicles').set('Authorization', auth).send(cuerpo);
const editar = (auth, id, cuerpo) =>
  request(app).patch(`/api/vehicles/${id}`).set('Authorization', auth).send(cuerpo);
const listar = (auth, query = '') => request(app).get(`/api/vehicles${query}`).set('Authorization', auth);

beforeEach(cleanTables);
afterAll(closePool);

describe('alta de vehículos', () => {
  test('test_registra_un_vehiculo_asociado_a_su_propietario', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient({ name: 'Ana Pérez' });

    const res = await crear(auth, valido(cliente.id, { vin: '1hgcm82633a004352', color: 'Gris', currentMileage: 15000 }));

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        clientId: cliente.id,
        vin: '1HGCM82633A004352',
        color: 'Gris',
        currentMileage: 15000
      })
    );
    expect(res.body.data.owner.name).toBe('Ana Pérez');
  });

  test('test_el_vehiculo_aparece_en_el_detalle_del_cliente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    await crear(auth, valido(cliente.id));

    const res = await request(app).get(`/api/clients/${cliente.id}`).set('Authorization', auth);

    expect(res.body.data.vehicles.map((v) => v.licensePlate)).toEqual(['XYZ987']);
  });

  test('test_normaliza_la_placa_a_mayusculas_sin_espacios_ni_guiones', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const res = await crear(auth, valido(cliente.id, { licensePlate: ' ab-c 123 ' }));

    expect(res.body.data.licensePlate).toBe('ABC123');
  });

  test('test_rechaza_un_vehiculo_sin_propietario', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await crear(auth, { brand: 'Toyota', model: 'Corolla', year: 2021, licensePlate: 'XYZ987' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('clientId');
  });

  test('test_rechaza_un_vehiculo_con_propietario_inexistente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await crear(auth, valido(99999));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.details).toEqual({ field: 'clientId' });
    expect((await listar(auth)).body.meta.total).toBe(0);
  });

  test.each([
    ['sin marca', { brand: undefined }, 'brand'],
    ['con marca de más de 60 caracteres', { brand: 'a'.repeat(61) }, 'brand'],
    ['sin modelo', { model: undefined }, 'model'],
    ['sin año', { year: undefined }, 'year'],
    ['con año anterior a 1950', { year: 1949 }, 'year'],
    ['con año posterior al año actual + 1', { year: new Date().getFullYear() + 2 }, 'year'],
    ['sin placa', { licensePlate: undefined }, 'licensePlate'],
    ['con placa de más de 15 caracteres', { licensePlate: 'A'.repeat(16) }, 'licensePlate'],
    ['con placa con símbolos', { licensePlate: 'AB*123' }, 'licensePlate'],
    ['con VIN de longitud incorrecta', { vin: 'ABC123' }, 'vin'],
    ['con VIN que contiene la letra O', { vin: '1HGCM82633A00435O' }, 'vin'],
    ['con color de más de 30 caracteres', { color: 'a'.repeat(31) }, 'color'],
    ['con kilometraje negativo', { currentMileage: -1 }, 'currentMileage'],
    ['con kilometraje decimal', { currentMileage: 10.5 }, 'currentMileage']
  ])('test_rechaza_un_alta_%s', async (_nombre, cambios, campo) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const res = await crear(auth, valido(cliente.id, cambios));

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });

  test('test_rechaza_una_placa_duplicada_aunque_cambie_el_formato', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    await crear(auth, valido(cliente.id, { licensePlate: 'ABC123' }));

    for (const placa of ['ABC123', 'abc123', 'abc-123', ' ABC 123 ']) {
      const res = await crear(auth, valido(cliente.id, { licensePlate: placa, brand: 'Kia' }));
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_LICENSE_PLATE');
    }
    expect((await listar(auth)).body.meta.total).toBe(1);
  });

  test('test_rechaza_un_vin_duplicado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    await crear(auth, valido(cliente.id, { vin: '1HGCM82633A004352' }));

    const res = await crear(auth, valido(cliente.id, { licensePlate: 'OTRA111', vin: '1hgcm82633a004352' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_VIN');
  });

  test('test_permite_varios_vehiculos_sin_vin', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const uno = await crear(auth, valido(cliente.id, { licensePlate: 'AAA111' }));
    const dos = await crear(auth, valido(cliente.id, { licensePlate: 'BBB222', vin: '' }));

    expect(uno.status).toBe(201);
    expect(dos.status).toBe(201);
    expect(dos.body.data.vin).toBeNull();
  });

  test('test_con_altas_concurrentes_de_la_misma_placa_solo_se_guarda_una', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const [a, b] = await Promise.all([
      crear(auth, valido(cliente.id, { licensePlate: 'CCC333' })),
      crear(auth, valido(cliente.id, { licensePlate: 'CCC333' }))
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await listar(auth)).body.meta.total).toBe(1);
  });

  test('test_el_mecanico_no_puede_registrar_ni_editar_vehiculos', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);

    expect((await crear(auth, valido(cliente.id))).status).toBe(403);
    expect((await editar(auth, vehiculo.id, { color: 'Azul' })).status).toBe(403);
  });

  test('test_exige_sesion_en_todas_las_rutas_de_vehiculos', async () => {
    expect((await request(app).get('/api/vehicles')).status).toBe(401);
    expect((await request(app).post('/api/vehicles').send({})).status).toBe(401);
    expect((await request(app).get('/api/vehicles/1')).status).toBe(401);
    expect((await request(app).patch('/api/vehicles/1').send({})).status).toBe(401);
  });
});

describe('consulta de vehículos', () => {
  test('test_busca_por_placa_marca_modelo_y_propietario', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const ana = await createClient({ name: 'Ana Pérez' });
    const luis = await createClient({ name: 'Luis Gómez' });
    await createVehicle(ana.id, { licensePlate: 'AAA111', brand: 'Nissan', model: 'Versa' });
    await createVehicle(luis.id, { licensePlate: 'BBB222', brand: 'Honda', model: 'Civic' });

    expect((await listar(auth, '?search=aaa')).body.data.map((v) => v.licensePlate)).toEqual(['AAA111']);
    expect((await listar(auth, '?search=honda')).body.data.map((v) => v.licensePlate)).toEqual(['BBB222']);
    expect((await listar(auth, '?search=versa')).body.data.map((v) => v.licensePlate)).toEqual(['AAA111']);
    expect((await listar(auth, '?search=gómez')).body.data.map((v) => v.licensePlate)).toEqual(['BBB222']);
    expect((await listar(auth, '?search=zzz')).body.data).toEqual([]);
  });

  test('test_filtra_por_propietario', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const ana = await createClient();
    const luis = await createClient();
    await createVehicle(ana.id, { licensePlate: 'AAA111' });
    await createVehicle(ana.id, { licensePlate: 'AAA222' });
    await createVehicle(luis.id, { licensePlate: 'BBB111' });

    const res = await listar(auth, `?clientId=${ana.id}`);

    expect(res.body.data.map((v) => v.licensePlate).sort()).toEqual(['AAA111', 'AAA222']);
    expect(res.body.meta.total).toBe(2);
  });

  test('test_pagina_el_listado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    for (let i = 1; i <= 25; i += 1) {
      await createVehicle(cliente.id, { licensePlate: `PAG${String(i).padStart(3, '0')}` });
    }

    const res = await listar(auth, '?page=2&pageSize=10');

    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 10, total: 25 });
  });

  test('test_los_tres_roles_pueden_consultar_el_listado_y_el_detalle', async () => {
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    for (const role of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const { auth } = await createAuthenticated(role);
      expect((await listar(auth)).status).toBe(200);
      const detalle = await request(app).get(`/api/vehicles/${vehiculo.id}`).set('Authorization', auth);
      expect(detalle.status).toBe(200);
      expect(detalle.body.data.owner.id).toBe(cliente.id);
    }
  });

  test('test_un_vehiculo_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/vehicles/9999').set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('edición de vehículos', () => {
  test('test_edita_los_datos_del_vehiculo_sin_cambiar_el_propietario', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id, { currentMileage: 1000 });

    const res = await editar(auth, vehiculo.id, { color: 'Rojo', model: 'Sentra', currentMileage: 2500 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ color: 'Rojo', model: 'Sentra', currentMileage: 2500, clientId: cliente.id })
    );
  });

  test('test_no_acepta_cambiar_el_propietario', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const ana = await createClient();
    const luis = await createClient();
    const vehiculo = await createVehicle(ana.id);

    const res = await editar(auth, vehiculo.id, { clientId: luis.id });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('clientId');
    const detalle = await request(app).get(`/api/vehicles/${vehiculo.id}`).set('Authorization', auth);
    expect(detalle.body.data.clientId).toBe(ana.id);
  });

  test('test_rechaza_bajar_el_kilometraje_sin_correccion_explicita', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id, { currentMileage: 50000 });

    const res = await editar(auth, vehiculo.id, { currentMileage: 40000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MILEAGE_DECREASE');
    const detalle = await request(app).get(`/api/vehicles/${vehiculo.id}`).set('Authorization', auth);
    expect(detalle.body.data.currentMileage).toBe(50000);
  });

  test('test_permite_bajar_el_kilometraje_con_correccion_explicita', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id, { currentMileage: 50000 });

    const res = await editar(auth, vehiculo.id, { currentMileage: 40000, mileageCorrection: true });

    expect(res.status).toBe(200);
    expect(res.body.data.currentMileage).toBe(40000);
  });

  test('test_permite_mantener_o_subir_el_kilometraje', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id, { currentMileage: 50000 });

    expect((await editar(auth, vehiculo.id, { currentMileage: 50000 })).status).toBe(200);
    expect((await editar(auth, vehiculo.id, { currentMileage: 50001 })).status).toBe(200);
  });

  test('test_rechaza_editar_la_placa_a_una_ya_registrada', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    await createVehicle(cliente.id, { licensePlate: 'AAA111' });
    const otro = await createVehicle(cliente.id, { licensePlate: 'BBB222' });

    const res = await editar(auth, otro.id, { licensePlate: 'aaa-111' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_LICENSE_PLATE');
  });

  test('test_permite_conservar_la_misma_placa_al_editar_otros_datos', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'AAA111' });

    const res = await editar(auth, vehiculo.id, { licensePlate: 'aaa 111', color: 'Negro' });

    expect(res.status).toBe(200);
    expect(res.body.data.licensePlate).toBe('AAA111');
  });

  test('test_editar_un_vehiculo_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await editar(auth, 9999, { color: 'Rojo' });

    expect(res.status).toBe(404);
  });

  test('test_una_edicion_vacia_responde_400', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);

    const res = await editar(auth, vehiculo.id, {});

    expect(res.status).toBe(400);
  });
});
