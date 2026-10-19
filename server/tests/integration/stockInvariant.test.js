// Auditoría de la invariante del inventario: para cada refacción, stock = suma de sus movimientos,
// y ningún stock es negativo. Se prepara un escenario variado (entradas, salidas, ajustes, órdenes y cancelaciones).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearRefaccion,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('Invariante del inventario', () => {
  test('tras_un_escenario_mixto_el_stock_de_toda_refaccion_coincide_con_la_suma_de_sus_movimientos', async () => {
    const datos = await crearClienteConVehiculo();
    const partes = [];
    for (let i = 0; i < 4; i += 1) partes.push(await crearRefaccion({ stock: 10 + i, salePrice: 25 }));

    for (const [indice, parte] of partes.entries()) {
      await request(app).post(`/api/parts/${parte.id}/movements`).set(como('ADMIN')).send({ type: 'IN', quantity: 5, reason: 'Compra' });
      await request(app).post(`/api/parts/${parte.id}/movements`).set(como('ADMIN')).send({ type: 'ADJUSTMENT', quantity: -(indice + 1), reason: 'Conteo' });
      // Una salida imposible no debe dejar rastro.
      await request(app).post(`/api/parts/${parte.id}/movements`).set(como('ADMIN')).send({ type: 'OUT', quantity: 500, reason: 'Imposible' });
    }
    for (let i = 0; i < 4; i += 1) {
      const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
      for (const parte of partes) {
        await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId: parte.id, quantity: i + 1 });
      }
      if (i % 2 === 0) {
        await request(app).post(`/api/orders/${orden}/status`).set(como('ADMIN')).send({ status: 'CANCELADA', reason: 'Prueba de invariante' });
      }
    }

    const [filas] = await pool.query(
      `SELECT p.id, p.stock, COALESCE(SUM(m.quantity), 0) AS suma
         FROM parts p LEFT JOIN inventory_movements m ON m.partId = p.id GROUP BY p.id`,
    );
    expect(filas).toHaveLength(4);
    for (const fila of filas) {
      expect(Number(fila.suma)).toBe(fila.stock);
      expect(fila.stock).toBeGreaterThanOrEqual(0);
    }
    // El stock registrado en cada movimiento coincide con el acumulado hasta ese punto.
    const [movimientos] = await pool.query('SELECT partId, quantity, stockAfter FROM inventory_movements ORDER BY partId, id');
    const acumulado = new Map();
    for (const m of movimientos) {
      const nuevo = (acumulado.get(m.partId) ?? 0) + m.quantity;
      expect(m.stockAfter).toBe(nuevo);
      acumulado.set(m.partId, nuevo);
    }
  });
});
