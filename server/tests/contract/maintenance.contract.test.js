// Pruebas de contrato de /api/maintenance (ver specs/003-historial-inventario/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMaintenance,
  createOrder,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const FORMA_MANTENIMIENTO = {
  id: expect.any(Number),
  vehicleId: expect.any(Number),
  vehiclePlate: expect.any(String),
  vehicleTitle: expect.any(String),
  clientId: expect.any(Number),
  clientName: expect.any(String),
  clientPhone: expect.any(String),
  orderId: expect.any(Number),
  orderFolio: expect.stringMatching(/^OS-\d{6}$/),
  description: expect.any(String),
  nextDate: null,
  nextMileage: expect.any(Number),
  currentMileage: expect.any(Number),
  status: expect.stringMatching(/^(PENDIENTE|REALIZADO|CANCELADO)$/),
  classification: expect.stringMatching(/^(OVERDUE|UPCOMING|LATER)$/),
  daysRemaining: null,
  kmRemaining: expect.any(Number),
  completedAt: null,
  createdAt: expect.any(String),
  canManage: expect.any(Boolean)
};

let mecanico;
let cliente;
let vehiculo;
let orden;

beforeEach(async () => {
  await cleanTables();
  mecanico = await createAuthenticated('MECHANIC');
  cliente = await createClient({ name: 'Ana Pérez', phone: '5512345678' });
  vehiculo = await createVehicle(cliente.id, { licensePlate: 'ABC123', currentMileage: 20000 });
  orden = await createOrder({
    clientId: cliente.id,
    vehicleId: vehiculo.id,
    mechanicId: mecanico.user.id,
    status: 'TERMINADO'
  });
});
afterAll(closePool);

describe('contrato de mantenimientos', () => {
  test('test_el_alta_responde_201_con_el_mantenimiento_y_su_clasificacion', async () => {
    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', mecanico.auth)
      .send({ orderId: orden.id, description: 'Cambio de aceite y filtro', nextMileage: 25000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      ...FORMA_MANTENIMIENTO,
      vehicleId: vehiculo.id,
      vehiclePlate: 'ABC123',
      clientName: 'Ana Pérez',
      clientPhone: '5512345678',
      orderId: orden.id,
      orderFolio: orden.folio,
      description: 'Cambio de aceite y filtro',
      nextMileage: 25000,
      currentMileage: 20000,
      status: 'PENDIENTE',
      classification: 'LATER',
      kmRemaining: 5000,
      canManage: true
    });
  });

  test('test_el_alta_con_fecha_devuelve_next_date_como_yyyy_mm_dd_y_dias_restantes', async () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 10);
    const p2 = (n) => String(n).padStart(2, '0');
    const nextDate = `${fecha.getFullYear()}-${p2(fecha.getMonth() + 1)}-${p2(fecha.getDate())}`;

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', mecanico.auth)
      .send({ orderId: orden.id, description: 'Revisión', nextDate });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ nextDate, nextMileage: null, daysRemaining: 10, kmRemaining: null, classification: 'UPCOMING' })
    );
  });

  test('test_el_detalle_devuelve_el_mantenimiento', async () => {
    const m = await createMaintenance(vehiculo.id, { orderId: orden.id });
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await request(app).get(`/api/maintenance/${m.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ ...FORMA_MANTENIMIENTO, id: m.id }));
  });

  test('test_los_mantenimientos_de_un_vehiculo_devuelven_data', async () => {
    await createMaintenance(vehiculo.id, { orderId: orden.id });

    const res = await request(app)
      .get(`/api/vehicles/${vehiculo.id}/maintenance`)
      .set('Authorization', mecanico.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining(FORMA_MANTENIMIENTO)]);
  });

  test('test_editar_responde_200_con_el_mantenimiento_actualizado', async () => {
    const m = await createMaintenance(vehiculo.id, { orderId: orden.id });

    const res = await request(app)
      .patch(`/api/maintenance/${m.id}`)
      .set('Authorization', mecanico.auth)
      .send({ description: 'Nuevo texto', nextMileage: 26000 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ description: 'Nuevo texto', nextMileage: 26000 })
    );
  });

  test('test_realizar_y_cancelar_responden_200_con_el_nuevo_estado', async () => {
    const a = await createMaintenance(vehiculo.id, { orderId: orden.id });
    const hecho = await request(app)
      .post(`/api/maintenance/${a.id}/complete`)
      .set('Authorization', mecanico.auth);
    const b = await createMaintenance(vehiculo.id, { orderId: orden.id });
    const cancelado = await request(app)
      .post(`/api/maintenance/${b.id}/cancel`)
      .set('Authorization', mecanico.auth);

    expect(hecho.status).toBe(200);
    expect(hecho.body.data).toEqual(
      expect.objectContaining({ status: 'REALIZADO', classification: null, completedAt: expect.any(String) })
    );
    expect(cancelado.status).toBe(200);
    expect(cancelado.body.data).toEqual(
      expect.objectContaining({ status: 'CANCELADO', classification: null, completedAt: expect.any(String) })
    );
  });

  test('test_un_segundo_pendiente_responde_409_con_el_pendiente_en_details', async () => {
    const existente = await createMaintenance(vehiculo.id, { orderId: orden.id });

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', mecanico.auth)
      .send({ orderId: orden.id, description: 'Otro', nextMileage: 30000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MAINTENANCE_PENDING_EXISTS');
    expect(res.body.error.details.pending).toEqual(
      expect.objectContaining({ id: existente.id, description: existente.description })
    );
  });

  test('test_cerrar_uno_ya_cerrado_responde_409_maintenance_not_pending', async () => {
    const m = await createMaintenance(vehiculo.id, { orderId: orden.id, status: 'REALIZADO' });

    const res = await request(app)
      .post(`/api/maintenance/${m.id}/complete`)
      .set('Authorization', mecanico.auth);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MAINTENANCE_NOT_PENDING');
  });

  test('test_una_orden_sin_terminar_responde_409_order_not_finished', async () => {
    const enCurso = await createOrder({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.user.id,
      status: 'EN_REPARACION'
    });

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', mecanico.auth)
      .send({ orderId: enCurso.id, description: 'Revisión', nextMileage: 25000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_FINISHED');
  });

  test('test_los_datos_invalidos_responden_400_validation_error', async () => {
    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', mecanico.auth)
      .send({ orderId: orden.id, description: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'description' })])
    );
  });
});
