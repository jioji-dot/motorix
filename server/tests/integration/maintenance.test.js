import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearUsuariosDePrueba,
  fechaDia,
  limpiarBase,
} from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const cuerpo = (vehicleId, extra = {}) => ({
  vehicleId,
  serviceType: 'Cambio de aceite',
  lastServiceDate: fechaDia(-5),
  lastMileage: 40000,
  nextDate: fechaDia(180),
  nextMileage: 45000,
  ...extra,
});

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('Mantenimientos (integración)', () => {
  test('admin_y_mecanico_registran_y_editan_y_recepcion_solo_consulta', async () => {
    const { vehicleId } = await crearClienteConVehiculo();
    for (const rol of ['ADMIN', 'MECHANIC']) {
      const creado = await request(app).post('/api/maintenance').set(como(rol)).send(cuerpo(vehicleId, { serviceType: `Servicio ${rol}` }));
      expect(creado.status).toBe(201);
      const editado = await request(app).patch(`/api/maintenance/${creado.body.data.id}`).set(como(rol)).send({ notes: 'ok' });
      expect(editado.status).toBe(200);
    }
    const escribe = await request(app).post('/api/maintenance').set(como('RECEPTIONIST')).send(cuerpo(vehicleId));
    expect(escribe.status).toBe(403);
    const edita = await request(app).patch('/api/maintenance/1').set(como('RECEPTIONIST')).send({ notes: 'x' });
    expect(edita.status).toBe(403);
    const consulta = await request(app).get('/api/maintenance').set(como('RECEPTIONIST'));
    expect(consulta.status).toBe(200);
  });

  test('registrar_otro_del_mismo_tipo_deja_atendido_al_anterior_sin_distinguir_mayusculas', async () => {
    const { vehicleId } = await crearClienteConVehiculo();
    const primero = await request(app).post('/api/maintenance').set(como('MECHANIC')).send(cuerpo(vehicleId));
    const otroTipo = await request(app).post('/api/maintenance').set(como('MECHANIC')).send(cuerpo(vehicleId, { serviceType: 'Frenos' }));
    const segundo = await request(app)
      .post('/api/maintenance')
      .set(como('MECHANIC'))
      .send(cuerpo(vehicleId, { serviceType: '  cambio DE ACEITE ' }));

    const anterior = await request(app).get(`/api/maintenance/${primero.body.data.id}`).set(como('ADMIN'));
    expect(anterior.body.data).toMatchObject({ status: 'ATENDIDO', classification: null });
    expect(anterior.body.data.completedAt).not.toBeNull();
    const distinto = await request(app).get(`/api/maintenance/${otroTipo.body.data.id}`).set(como('ADMIN'));
    expect(distinto.body.data.status).toBe('PENDIENTE');
    expect(segundo.body.data.status).toBe('PENDIENTE');

    const pendientes = await request(app).get(`/api/maintenance?vehicleId=${vehicleId}`).set(como('ADMIN'));
    expect(pendientes.body.meta.total).toBe(2);
  });

  test('el_reemplazo_no_toca_los_mantenimientos_de_otro_vehiculo', async () => {
    const a = await crearClienteConVehiculo();
    const b = await crearClienteConVehiculo();
    const deA = await request(app).post('/api/maintenance').set(como('ADMIN')).send(cuerpo(a.vehicleId));
    await request(app).post('/api/maintenance').set(como('ADMIN')).send(cuerpo(b.vehicleId));
    const sigue = await request(app).get(`/api/maintenance/${deA.body.data.id}`).set(como('ADMIN'));
    expect(sigue.body.data.status).toBe('PENDIENTE');
  });

  test('enlaza_la_orden_de_origen_cuando_existe', async () => {
    const datos = await crearClienteConVehiculo();
    const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'TERMINADO' });
    const creado = await request(app)
      .post('/api/maintenance')
      .set(como('MECHANIC'))
      .send(cuerpo(datos.vehicleId, { sourceOrderId: orden }));
    expect(creado.status).toBe(201);
    expect(creado.body.data.sourceOrderId).toBe(orden);
  });

  test('la_base_rechaza_un_mantenimiento_sin_proxima_fecha_ni_kilometraje_aunque_falle_la_validacion', async () => {
    const { vehicleId } = await crearClienteConVehiculo();
    await expect(
      pool.execute(
        "INSERT INTO maintenance (vehicleId, serviceType, lastServiceDate, lastMileage, createdBy) VALUES (?, 'X', '2026-01-01', 10, ?)",
        [vehicleId, usuarios.ADMIN.id],
      ),
    ).rejects.toThrow();
  });
});
