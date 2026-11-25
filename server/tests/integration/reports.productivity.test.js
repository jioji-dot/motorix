// Productividad por mecánico (Sprint 7, FR-011, FR-015, FR-017).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearClienteConVehiculo, crearOrden, crearSegundoMecanico, crearUsuariosDePrueba, fechaDia, limpiarBase, terminarEn,
} from '../helpers.js';

let usuarios;
let otro;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  otro = await crearSegundoMecanico();
  const nueva = async (mecanico, estado, fecha, mano) => {
    const c = await crearClienteConVehiculo();
    const id = await crearOrden({ ...c, mechanicId: mecanico.id, createdBy: usuarios.ADMIN.id, status: estado });
    for (const [horas, tarifa] of mano) await pool.execute('INSERT INTO order_labor (orderId, description, hours, hourlyRate) VALUES (?, ?, ?, ?)', [id, 'Mano de obra', horas, tarifa]);
    if (fecha) await terminarEn(id, fecha, estado);
  };
  await nueva(usuarios.MECHANIC, 'TERMINADO', fechaDia(-2), [[1.5, 350], [1, 100]]); // 625.00
  await nueva(usuarios.MECHANIC, 'ENTREGADO', fechaDia(-1), [[2, 300]]); // 600.00
  await nueva(otro, 'TERMINADO', fechaDia(-1), [[0.5, 350.5]]); // 175.25
  await nueva(otro, 'EN_REPARACION', null, [[9, 9]]);
  await nueva(otro, 'CANCELADA', null, [[9, 9]]);
});
afterAll(cerrarConexiones);

const consultar = (u, consulta) => request(app).get(`/api/reports/productivity${consulta}`).set({ Authorization: `Bearer ${u.token}` });
const rango = `?from=${fechaDia(-5)}&to=${fechaDia(0)}`;

test('cada_mecanico_muestra_sus_ordenes_terminadas_y_su_mano_de_obra_en_centavos', async () => {
  const r = await consultar(usuarios.ADMIN, rango);
  expect(r.status).toBe(200);
  const por = Object.fromEntries(r.body.data.items.map((i) => [i.mechanic.id, i]));
  expect(por[usuarios.MECHANIC.id]).toMatchObject({ orders: 2, laborAmount: '1225.00', mechanic: { name: usuarios.MECHANIC.name } });
  expect(por[otro.id]).toMatchObject({ orders: 1, laborAmount: '175.25' });
  expect(r.body.data).toMatchObject({ totalOrders: 3, totalLabor: '1400.25' });
});

test('no_cuentan_las_ordenes_en_curso_ni_canceladas', async () => {
  const r = await consultar(usuarios.ADMIN, rango);
  expect(r.body.data.items.reduce((t, i) => t + i.orders, 0)).toBe(3);
});

test('un_rango_sin_ordenes_devuelve_ceros', async () => {
  expect((await consultar(usuarios.ADMIN, '?from=2000-01-01&to=2000-01-02')).body.data).toEqual({ items: [], totalOrders: 0, totalLabor: '0.00' });
});

test('recepcion_y_mecanico_reciben_403', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) expect((await consultar(u, rango)).status).toBe(403);
});
