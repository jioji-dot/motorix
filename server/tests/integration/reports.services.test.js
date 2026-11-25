// Servicios más frecuentes (Sprint 7, FR-010, FR-015, FR-017).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import * as serviceTypeModel from '../../models/serviceTypeModel.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, fechaDia, limpiarBase, terminarEn } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const aceite = await serviceTypeModel.create({ name: 'Cambio de aceite', intervalDays: 180 });
  const nueva = async (estado, fecha, lineas) => {
    const c = await crearClienteConVehiculo();
    const id = await crearOrden({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status: estado });
    for (const [descripcion, importe, tipo] of lineas) {
      await pool.execute('INSERT INTO order_services (orderId, description, amount, serviceTypeId) VALUES (?, ?, ?, ?)', [id, descripcion, importe, tipo ?? null]);
    }
    if (fecha) await terminarEn(id, fecha, estado);
    return id;
  };
  await nueva('TERMINADO', fechaDia(-3), [['Aceite 5W30', '100.10', aceite], ['Aceite extra', '10.00', aceite], ['Alineación', '200.00']]);
  await nueva('ENTREGADO', fechaDia(-2), [['Aceite 10W40', '150.20', aceite], ['alineación ', '210.00']]); // Terminada y luego Entregada: una sola vez
  await nueva('EN_REPARACION', null, [['En curso', '999.00']]);
  await nueva('CANCELADA', null, [['Cancelada', '999.00']]);
  await nueva('TERMINADO', fechaDia(-60), [['Fuera de rango', '999.00']]);
});
afterAll(cerrarConexiones);

const consultar = (u, consulta) => request(app).get(`/api/reports/services${consulta}`).set({ Authorization: `Bearer ${u.token}` });
const rango = `?from=${fechaDia(-5)}&to=${fechaDia(0)}`;

test('agrupa_por_tipo_o_por_descripcion_y_ordena_de_mayor_a_menor_cantidad', async () => {
  const r = await consultar(usuarios.ADMIN, rango);
  expect(r.status).toBe(200);
  expect(r.body.data.items).toEqual([
    { name: 'Cambio de aceite', typed: true, count: 3, amount: '260.30' },
    { name: expect.stringMatching(/alineaci[oó]n/i), typed: false, count: 2, amount: '410.00' },
  ]);
});

test('no_cuentan_las_ordenes_en_curso_canceladas_ni_fuera_de_rango', async () => {
  const texto = JSON.stringify((await consultar(usuarios.ADMIN, rango)).body);
  for (const fuera of ['En curso', 'Cancelada', 'Fuera de rango']) expect(texto).not.toContain(fuera);
});

test('sin_ordenes_devuelve_una_lista_vacia', async () => {
  expect((await consultar(usuarios.ADMIN, '?from=2000-01-01&to=2000-01-02')).body.data.items).toEqual([]);
});

test('recepcion_y_mecanico_reciben_403', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) expect((await consultar(u, rango)).status).toBe(403);
});
