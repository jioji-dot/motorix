// Pruebas de permisos del Sprint 3 contra `motorix_test` (se completan en la fase de cierre).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMaintenance,
  createOrder,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

let cliente;
let vehiculo;
let ordenDelMecanico;
let mecanico;

beforeEach(async () => {
  await cleanTables();
  mecanico = await createAuthenticated('MECHANIC');
  cliente = await createClient();
  vehiculo = await createVehicle(cliente.id, { currentMileage: 1000 });
  ordenDelMecanico = await createOrder({
    clientId: cliente.id,
    vehicleId: vehiculo.id,
    mechanicId: mecanico.user.id,
    status: 'TERMINADO'
  });
});
afterAll(closePool);

describe('permisos de mantenimientos', () => {
  test('test_el_administrador_registra_desde_cualquier_orden', async () => {
    const admin = await createAuthenticated('ADMIN');

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', admin.auth)
      .send({ orderId: ordenDelMecanico.id, description: 'Revisión', nextMileage: 5000 });

    expect(res.status).toBe(201);
  });

  test('test_un_mecanico_no_registra_desde_la_orden_de_otro_mecanico', async () => {
    const otro = await createAuthenticated('MECHANIC');

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', otro.auth)
      .send({ orderId: ordenDelMecanico.id, description: 'Revisión', nextMileage: 5000 });

    expect(res.status).toBe(404);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM maintenance');
    expect(total).toBe(0);
  });

  test('test_la_recepcion_no_puede_registrar_editar_ni_cerrar', async () => {
    const recepcion = await createAuthenticated('RECEPTIONIST');
    const m = await createMaintenance(vehiculo.id, { orderId: ordenDelMecanico.id });

    const respuestas = await Promise.all([
      request(app)
        .post('/api/maintenance')
        .set('Authorization', recepcion.auth)
        .send({ orderId: ordenDelMecanico.id, description: 'Revisión', nextMileage: 5000 }),
      request(app).patch(`/api/maintenance/${m.id}`).set('Authorization', recepcion.auth).send({ description: 'x' }),
      request(app).post(`/api/maintenance/${m.id}/complete`).set('Authorization', recepcion.auth),
      request(app).post(`/api/maintenance/${m.id}/cancel`).set('Authorization', recepcion.auth)
    ]);

    for (const res of respuestas) expect(res.status).toBe(403);
  });

  test('test_un_mecanico_edita_y_cierra_solo_los_mantenimientos_de_sus_ordenes', async () => {
    const otro = await createAuthenticated('MECHANIC');
    const ajeno = await createMaintenance(vehiculo.id, { orderId: ordenDelMecanico.id });

    const edicion = await request(app)
      .patch(`/api/maintenance/${ajeno.id}`)
      .set('Authorization', otro.auth)
      .send({ description: 'x' });
    const cierre = await request(app).post(`/api/maintenance/${ajeno.id}/complete`).set('Authorization', otro.auth);
    const propio = await request(app)
      .post(`/api/maintenance/${ajeno.id}/complete`)
      .set('Authorization', mecanico.auth);

    expect(edicion.status).toBe(404);
    expect(cierre.status).toBe(404);
    expect(propio.status).toBe(200);
  });

  test('test_el_administrador_edita_y_cierra_cualquiera', async () => {
    const admin = await createAuthenticated('ADMIN');
    const m = await createMaintenance(vehiculo.id, { orderId: ordenDelMecanico.id });

    const edicion = await request(app)
      .patch(`/api/maintenance/${m.id}`)
      .set('Authorization', admin.auth)
      .send({ description: 'Ajustado' });
    const cierre = await request(app).post(`/api/maintenance/${m.id}/cancel`).set('Authorization', admin.auth);

    expect(edicion.status).toBe(200);
    expect(cierre.status).toBe(200);
  });

  test('test_todos_los_roles_leen_los_mantenimientos_de_un_vehiculo', async () => {
    await createMaintenance(vehiculo.id, { orderId: ordenDelMecanico.id });
    const lectores = [
      mecanico,
      await createAuthenticated('MECHANIC'),
      await createAuthenticated('RECEPTIONIST'),
      await createAuthenticated('ADMIN')
    ];

    for (const { auth } of lectores) {
      const res = await request(app).get(`/api/vehicles/${vehiculo.id}/maintenance`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }
  });

  test('test_el_detalle_lo_ven_administracion_recepcion_y_el_mecanico_que_trabajo_el_vehiculo', async () => {
    const m = await createMaintenance(vehiculo.id, { orderId: ordenDelMecanico.id });
    const sinRelacion = await createAuthenticated('MECHANIC');
    const admin = await createAuthenticated('ADMIN');
    const recepcion = await createAuthenticated('RECEPTIONIST');

    const ver = (auth) => request(app).get(`/api/maintenance/${m.id}`).set('Authorization', auth);

    expect((await ver(admin.auth)).status).toBe(200);
    expect((await ver(recepcion.auth)).status).toBe(200);
    expect((await ver(mecanico.auth)).status).toBe(200);
    expect((await ver(sinRelacion.auth)).status).toBe(404);
  });

  test('test_sin_token_responde_401_en_todas_las_rutas_de_mantenimiento', async () => {
    const m = await createMaintenance(vehiculo.id, { orderId: ordenDelMecanico.id });

    const respuestas = await Promise.all([
      request(app).post('/api/maintenance').send({}),
      request(app).get(`/api/maintenance/${m.id}`),
      request(app).patch(`/api/maintenance/${m.id}`).send({}),
      request(app).post(`/api/maintenance/${m.id}/complete`),
      request(app).get(`/api/vehicles/${vehiculo.id}/maintenance`)
    ]);

    for (const res of respuestas) expect(res.status).toBe(401);
  });
});
