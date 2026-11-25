// Refacciones: costo, venta y margen, y rotación del inventario (Sprint 7, FR-012, FR-013, FR-015, FR-017).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearClienteConVehiculo, crearLineaDeRefaccion, crearOrden, crearRefaccion, crearUsuariosDePrueba, fechaDia, limpiarBase, terminarEn,
} from '../helpers.js';

let usuarios;
let conCosto;
let sinCosto;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  conCosto = await crearRefaccion({ stock: 10, minimumStock: 2, purchasePrice: 80.25, salePrice: 120.5, name: 'Filtro con costo' });
  sinCosto = await crearRefaccion({ stock: 4, minimumStock: 1, purchasePrice: 0, salePrice: 50, name: 'Pieza sin costo' });
  const agotada = await crearRefaccion({ stock: 0, minimumStock: 1, purchasePrice: 10, salePrice: 20, name: 'Pieza agotada' });
  const orden = async (estado, fecha, lineas) => {
    const c = await crearClienteConVehiculo();
    const id = await crearOrden({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status: estado });
    for (const [parte, cantidad, precio] of lineas) await crearLineaDeRefaccion({ orderId: id, partId: parte.id, quantity: cantidad, unitPrice: precio });
    await terminarEn(id, fecha, estado);
    return id;
  };
  const o1 = await orden('TERMINADO', fechaDia(-2), [[conCosto, 2, 120.5], [sinCosto, 1, 50]]);
  const o2 = await orden('ENTREGADO', fechaDia(-1), [[conCosto, 1, 130]]);
  await orden('TERMINADO', fechaDia(-90), [[conCosto, 5, 120.5]]); // fuera de rango
  const salida = (parte, cantidad, orderId, fecha) => pool.execute(
    "INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, orderId, createdBy, createdAt) VALUES (?, 'OUT', ?, 1, 'Uso en orden', ?, ?, ?)",
    [parte.id, -cantidad, orderId, usuarios.ADMIN.id, `${fecha} 12:00:00`],
  );
  await salida(conCosto, 2, o1, fechaDia(-2));
  await salida(conCosto, 1, o2, fechaDia(-1));
  await salida(sinCosto, 1, o1, fechaDia(-2));
  await salida(conCosto, 5, o2, fechaDia(-90)); // fuera de rango
  await salida(agotada, 3, o1, fechaDia(-1));
});
afterAll(cerrarConexiones);

const consultar = (u, ruta, consulta) => request(app).get(`/api/reports/${ruta}${consulta}`).set({ Authorization: `Bearer ${u.token}` });
const rango = `?from=${fechaDia(-5)}&to=${fechaDia(0)}`;

test('unidades_costo_venta_y_margen_coinciden_con_las_lineas_en_centavos', async () => {
  const r = await consultar(usuarios.ADMIN, 'parts', rango);
  expect(r.status).toBe(200);
  const fila = r.body.data.items.find((i) => i.part.id === conCosto.id);
  // 3 unidades: venta 2 x 120.50 + 1 x 130.00 = 371.00; costo 3 x 80.25 = 240.75; margen 130.25
  expect(fila).toMatchObject({ units: 3, sale: '371.00', cost: '240.75', margin: '130.25', noCost: false, part: { code: conCosto.code, name: 'Filtro con costo' } });
});

test('la_refaccion_con_precio_de_compra_0_sale_sin_costo_y_no_entra_en_los_totales_de_costo_y_margen', async () => {
  const r = await consultar(usuarios.ADMIN, 'parts', rango);
  const fila = r.body.data.items.find((i) => i.part.id === sinCosto.id);
  expect(fila).toMatchObject({ units: 1, sale: '50.00', cost: null, margin: null, noCost: true });
  expect(r.body.data).toMatchObject({ totalSale: '421.00', totalCost: '240.75', totalMargin: '130.25' });
});

test('una_orden_fuera_del_rango_no_cuenta', async () => {
  const r = await consultar(usuarios.ADMIN, 'parts', rango);
  expect(r.body.data.items.find((i) => i.part.id === conCosto.id).units).toBe(3);
});

test('la_rotacion_divide_las_unidades_salidas_del_rango_entre_la_existencia_actual', async () => {
  const r = await consultar(usuarios.ADMIN, 'rotation', rango);
  expect(r.status).toBe(200);
  const por = Object.fromEntries(r.body.data.items.map((i) => [i.part.name, i]));
  expect(por['Filtro con costo']).toMatchObject({ unitsOut: 3, stock: 10, rotation: 0.3 });
  expect(por['Pieza sin costo']).toMatchObject({ unitsOut: 1, stock: 4, rotation: 0.25 });
  expect(por['Pieza agotada']).toMatchObject({ unitsOut: 3, stock: 0, rotation: null });
});

test('solo_el_administrador_y_sin_exponer_precios_de_compra_a_otros_roles', async () => {
  for (const ruta of ['parts', 'rotation']) {
    for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) {
      const r = await consultar(u, ruta, rango);
      expect(r.status).toBe(403);
      expect(JSON.stringify(r.body)).not.toMatch(/purchasePrice|80\.25|cost/);
    }
  }
});
