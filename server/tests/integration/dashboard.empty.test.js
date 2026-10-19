import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let admin;

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
});

afterAll(cerrarConexiones);

describe('Panel de control sin datos', () => {
  test('con_la_base_vacia_todo_vale_cero_o_lista_vacia_y_no_hay_errores', async () => {
    const respuesta = await request(app).get('/api/dashboard').set({ Authorization: `Bearer ${admin.token}` });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      orders: { byStatus: {}, withBalance: { count: 0, amount: '0.00' } },
      appointments: { today: 0, upcoming: 0, next: [] },
      maintenance: { overdue: 0, soon: 0 },
      inventory: { low: 0, out: 0, mostUrgent: [] },
      payments: { collectedToday: '0.00', collectedMonth: '0.00', pendingToCollect: '0.00' },
    });
  });
});
