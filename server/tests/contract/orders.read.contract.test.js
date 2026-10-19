// Contrato de GET /api/orders y GET /api/orders/:id (specs/002-citas-ordenes-servicio/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
let ordenId;
const auth = (rol = 'RECEPTIONIST') => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
  ordenId = await crearOrden({
    ...datos,
    mechanicId: usuarios.MECHANIC.id,
    createdBy: usuarios.RECEPTIONIST.id,
    status: 'EN_REPARACION',
    diagnosis: 'Falla en la bomba de agua',
  });
  await pool.execute("INSERT INTO order_services (orderId, description, amount) VALUES (?, 'Cambio de bomba de agua', 1850.50)", [ordenId]);
  await pool.execute("INSERT INTO order_labor (orderId, description, hours, hourlyRate) VALUES (?, 'Desmontaje y montaje', 2.5, 300)", [ordenId]);
  await pool.execute('UPDATE service_orders SET total = 2600.50 WHERE id = ?', [ordenId]);
});

afterAll(cerrarConexiones);

const RESUMEN = {
  id: expect.any(Number),
  folio: expect.stringMatching(/^OS-\d{6}$/),
  status: 'EN_REPARACION',
  clientId: expect.any(Number),
  vehicleId: expect.any(Number),
  mechanicId: expect.any(Number),
  appointmentId: null,
  entryMileage: 40000,
  reportedProblem: 'Ruido en el motor',
  total: '2600.50',
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
  client: { id: expect.any(Number), name: expect.any(String) },
  vehicle: { id: expect.any(Number), brand: 'Nissan', model: 'Versa', year: 2020, licensePlate: expect.any(String) },
  mechanic: { id: expect.any(Number), name: 'Mecánico de prueba' },
};

describe('GET /api/orders', () => {
  test('responde_200_con_data_resumida_y_meta_de_paginacion', async () => {
    const respuesta = await request(app).get('/api/orders?page=1&pageSize=10').set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([RESUMEN]);
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 10, total: 1 });
  });

  test('el_listado_no_incluye_lineas_ni_historial', async () => {
    const respuesta = await request(app).get('/api/orders').set(auth());
    expect(respuesta.body.data[0]).not.toHaveProperty('services');
    expect(respuesta.body.data[0]).not.toHaveProperty('history');
  });

  test('responde_400_si_el_estado_no_es_valido_y_401_sin_token', async () => {
    expect((await request(app).get('/api/orders?status=OTRO').set(auth())).status).toBe(400);
    expect((await request(app).get('/api/orders')).status).toBe(401);
  });
});

describe('GET /api/orders/:id', () => {
  test('responde_200_con_el_detalle_completo', async () => {
    const respuesta = await request(app).get(`/api/orders/${ordenId}`).set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: {
        ...RESUMEN,
        diagnosis: 'Falla en la bomba de agua',
        notes: null,
        recommendations: null,
        cancellationReason: null,
        deliveredAt: null,
        services: [{ id: expect.any(Number), description: 'Cambio de bomba de agua', amount: '1850.50' }],
        labor: [
          { id: expect.any(Number), description: 'Desmontaje y montaje', hours: '2.50', hourlyRate: '300.00', amount: '750.00' },
        ],
        history: [
          {
            fromStatus: null,
            toStatus: 'EN_REPARACION',
            changedBy: { id: usuarios.RECEPTIONIST.id, name: 'Recepción de prueba' },
            reason: null,
            changedAt: expect.any(String),
          },
        ],
        allowedTransitions: expect.any(Array),
      },
    });
  });

  test('responde_403_a_un_mecanico_ajeno_con_error_estandar_y_404_si_no_existe', async () => {
    await pool.execute(
      "INSERT INTO users (username, name, email, passwordHash, role) VALUES ('mec.ajeno', 'Mecánico ajeno', 'ajeno@motorix.test', 'x', 'MECHANIC')",
    );
    const [[ajeno]] = await pool.query("SELECT id FROM users WHERE username = 'mec.ajeno'");
    const jwt = (await import('jsonwebtoken')).default;
    const { env } = await import('../../config/env.js');
    const token = jwt.sign({ sub: ajeno.id }, env.jwt.secret, { expiresIn: '1h' });

    const respuesta = await request(app).get(`/api/orders/${ordenId}`).set({ Authorization: `Bearer ${token}` });
    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
    expect((await request(app).get('/api/orders/987654').set(auth())).status).toBe(404);
  });
});
