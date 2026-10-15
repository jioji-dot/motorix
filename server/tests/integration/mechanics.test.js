// Pruebas de integración del catálogo de mecánicos (US4) contra la base `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createMechanic, createUser } from '../helpers/factories.js';

const app = createApp();

beforeEach(cleanTables);
afterAll(closePool);

describe('catálogo de mecánicos activos', () => {
  test('test_devuelve_solo_mecanicos_activos_ordenados_por_nombre_con_id_nombre_y_usuario', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const zoe = await createMechanic({ name: 'Zoe Mecánica', username: 'zoe' });
    const ana = await createMechanic({ name: 'Ana Mecánica', username: 'ana.meca' });
    await createMechanic({ name: 'Inactivo', active: false });
    await createUser({ role: 'ADMIN', name: 'Admin' });
    await createUser({ role: 'RECEPTIONIST', name: 'Otra recepcionista' });

    const res = await request(app).get('/api/mechanics').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: ana.id, name: 'Ana Mecánica', username: 'ana.meca' },
      { id: zoe.id, name: 'Zoe Mecánica', username: 'zoe' }
    ]);
  });

  test('test_no_expone_correo_rol_ni_datos_de_contrasena', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await createMechanic();

    const res = await request(app).get('/api/mechanics').set('Authorization', auth);

    expect(Object.keys(res.body.data[0]).sort()).toEqual(['id', 'name', 'username']);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|email|role/i);
  });

  test('test_el_administrador_y_la_recepcionista_pueden_consultarlo', async () => {
    await createMechanic();
    for (const role of ['ADMIN', 'RECEPTIONIST']) {
      const { auth } = await createAuthenticated(role);
      expect((await request(app).get('/api/mechanics').set('Authorization', auth)).status).toBe(200);
    }
  });

  test('test_el_mecanico_recibe_403', async () => {
    const { auth } = await createAuthenticated('MECHANIC');

    const res = await request(app).get('/api/mechanics').set('Authorization', auth);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('test_exige_sesion', async () => {
    expect((await request(app).get('/api/mechanics')).status).toBe(401);
  });
});
