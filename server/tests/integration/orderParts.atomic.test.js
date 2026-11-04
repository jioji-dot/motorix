// Agregar, cambiar la cantidad o quitar una refacción es todo o nada (Sprint 5, FR-024): si algo falla después del
// movimiento de inventario, no queda ningún cambio en el stock, los movimientos, las líneas ni el total.
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import * as modeloLineas from '../../models/orderPartModel.js';
import { createOrderPartService } from '../../services/orderPartService.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearRefaccion,
  crearUsuariosDePrueba,
  limpiarBase,
  sumaDeMovimientos,
} from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });

// Servicio real con un modelo de líneas cuya operación indicada falla justo después del movimiento de inventario.
const servicioQueFalla = (operacion) =>
  createOrderPartService({
    orderPartModel: { ...modeloLineas, [operacion]: async () => { throw new Error('Fallo simulado'); } },
  });

async function estado(orden, partId) {
  const detalle = (await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'))).body.data;
  const [[{ movimientos }]] = await pool.query('SELECT COUNT(*) AS movimientos FROM inventory_movements WHERE partId = ?', [partId]);
  return { total: detalle.total, lineas: detalle.parts.map((l) => [l.id, l.quantity]), movimientos, stock: (await sumaDeMovimientos(partId)).stock };
}

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Operaciones de refacciones todo o nada (integración, Sprint 5)', () => {
  test('si_falla_el_alta_de_la_linea_no_queda_el_movimiento_ni_el_stock_ni_el_total_cambian', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, salePrice: 100 });
    const antes = await estado(orden, id);
    await expect(servicioQueFalla('add').add(orden, { partId: id, quantity: 2 }, usuarios.ADMIN)).rejects.toThrow('Fallo simulado');
    expect(await estado(orden, id)).toEqual(antes);
  });

  test('si_falla_el_cambio_de_cantidad_se_conserva_la_cantidad_el_stock_y_los_movimientos', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, salePrice: 100 });
    const alta = await request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId: id, quantity: 2 });
    const lineId = alta.body.data.parts[0].id;
    const antes = await estado(orden, id);
    await expect(servicioQueFalla('setQuantity').update(orden, lineId, { quantity: 5 }, usuarios.ADMIN)).rejects.toThrow('Fallo simulado');
    expect(await estado(orden, id)).toEqual(antes);
    await expect(servicioQueFalla('setQuantity').update(orden, lineId, { quantity: 1 }, usuarios.ADMIN)).rejects.toThrow('Fallo simulado');
    expect(await estado(orden, id)).toEqual(antes);
  });

  test('si_falla_la_baja_de_la_linea_no_regresa_el_stock_ni_cambia_el_total', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, salePrice: 100 });
    const alta = await request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId: id, quantity: 3 });
    const lineId = alta.body.data.parts[0].id;
    const antes = await estado(orden, id);
    await expect(servicioQueFalla('remove').remove(orden, lineId, usuarios.ADMIN)).rejects.toThrow('Fallo simulado');
    expect(await estado(orden, id)).toEqual(antes);
  });

  test('sin_fallos_las_mismas_operaciones_si_cambian_stock_movimientos_linea_y_total_juntos', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, salePrice: 100 });
    await request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId: id, quantity: 3 });
    const despues = await estado(orden, id);
    expect(despues.total).toBe('300.00');
    expect(despues.stock).toBe(7);
    expect(despues.movimientos).toBe(2); // existencia inicial + salida
  });
});
