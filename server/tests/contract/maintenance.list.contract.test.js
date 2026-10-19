// Contrato de GET /api/maintenance (specs/003-.../contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearMantenimiento,
  crearUsuariosDePrueba,
  fechaDia,
  limpiarBase,
} from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const datos = await crearClienteConVehiculo({ km: 40000 });
  await crearMantenimiento({ vehicleId: datos.vehicleId, createdBy: usuarios.ADMIN.id, nextDate: fechaDia(-3) });
});

afterAll(cerrarConexiones);

describe('GET /api/maintenance', () => {
  test('responde_200_con_data_y_meta_y_la_forma_de_cada_mantenimiento', async () => {
    const respuesta = await request(app).get('/api/maintenance').set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(respuesta.body.data[0]).toMatchObject({
      status: 'PENDIENTE',
      classification: 'VENCIDO',
      daysLeft: -3,
      kmLeft: null,
      vehicle: { licensePlate: expect.any(String), currentMileage: 40000 },
      client: { name: expect.any(String), phone: expect.any(String) },
    });
  });

  test('acepta_clasificaciones_validas_separadas_por_coma_y_rechaza_las_invalidas', async () => {
    const ok = await request(app).get('/api/maintenance?classification=VENCIDO,PROXIMO').set(como('ADMIN'));
    expect(ok.status).toBe(200);
    const mal = await request(app).get('/api/maintenance?classification=URGENTE').set(como('ADMIN'));
    expect(mal.status).toBe(400);
    expect(mal.body.error.code).toBe('VALIDATION_ERROR');
    const estado = await request(app).get('/api/maintenance?status=otro').set(como('ADMIN'));
    expect(estado.status).toBe(400);
  });

  test('responde_401_sin_token', async () => {
    const respuesta = await request(app).get('/api/maintenance');
    expect(respuesta.status).toBe(401);
  });
});
