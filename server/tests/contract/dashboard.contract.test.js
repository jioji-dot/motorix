// Contrato de GET /api/dashboard (specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('GET /api/dashboard', () => {
  test('responde_200_al_administrador_con_la_forma_documentada', async () => {
    const respuesta = await request(app).get('/api/dashboard').set(como('ADMIN'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      generatedAt: expect.any(String),
      orders: { byStatus: expect.any(Object), withBalance: { count: expect.any(Number), amount: expect.stringMatching(/^\d+\.\d{2}$/) } },
      appointments: { today: expect.any(Number), upcoming: expect.any(Number), next: expect.any(Array) },
      maintenance: { overdue: expect.any(Number), soon: expect.any(Number) },
      inventory: { low: expect.any(Number), out: expect.any(Number), mostUrgent: expect.any(Array) },
      payments: {
        collectedToday: expect.stringMatching(/^\d+\.\d{2}$/),
        collectedMonth: expect.stringMatching(/^\d+\.\d{2}$/),
        pendingToCollect: expect.stringMatching(/^\d+\.\d{2}$/),
      },
    });
  });

  test('responde_403_a_recepcion_y_mecanico_con_error_estandar_y_401_sin_token', async () => {
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      const respuesta = await request(app).get('/api/dashboard').set(como(rol));
      expect(respuesta.status).toBe(403);
      expect(respuesta.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
    }
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });
});
