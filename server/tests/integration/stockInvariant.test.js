// Invariante del inventario (SC-007) sobre `motorix_test`: tras una secuencia aleatoria y
// reproducible de entradas, ajustes y cambios de refacciones en órdenes, la existencia de cada
// refacción es igual a la suma de sus movimientos y nunca es negativa.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createPart } from '../helpers/factories.js';

const app = createApp();

/** Generador pseudoaleatorio con semilla (mulberry32): la secuencia es reproducible. */
function generador(semilla) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function verificarInvariante() {
  const [filas] = await pool.query(
    `SELECT p.code, p.stock, COALESCE(SUM(m.quantity), 0) AS suma
     FROM parts p LEFT JOIN inventory_movements m ON m.part_id = p.id GROUP BY p.id`
  );
  for (const fila of filas) {
    expect(Number(fila.suma)).toBe(fila.stock);
    expect(fila.stock).toBeGreaterThanOrEqual(0);
  }
  // Cada línea de orden coincide con sus salidas menos sus devoluciones.
  const [lineas] = await pool.query(
    `SELECT op.order_id, op.part_id, op.quantity,
            (SELECT COALESCE(SUM(-m.quantity), 0) FROM inventory_movements m
             WHERE m.order_id = op.order_id AND m.part_id = op.part_id) AS neto
     FROM order_parts op`
  );
  for (const linea of lineas) expect(Number(linea.neto)).toBe(linea.quantity);
  // Una refacción retirada de una orden no deja salidas netas pendientes.
  const [huerfanos] = await pool.query(
    `SELECT m.order_id, m.part_id, SUM(-m.quantity) AS neto
     FROM inventory_movements m
     WHERE m.order_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM order_parts op WHERE op.order_id = m.order_id AND op.part_id = m.part_id)
     GROUP BY m.order_id, m.part_id HAVING neto <> 0`
  );
  expect(huerfanos).toEqual([]);
}

let admin;
let mecanicos;
let ordenes;
let piezas;

beforeEach(async () => {
  await cleanTables();
  admin = await createAuthenticated('ADMIN');
  mecanicos = [await createAuthenticated('MECHANIC'), await createAuthenticated('MECHANIC')];
  ordenes = [];
  for (const m of mecanicos) {
    for (let i = 0; i < 2; i += 1) {
      ordenes.push({
        mecanico: m,
        orden: await createOrder({ mechanicId: m.user.id, status: 'EN_REPARACION' })
      });
    }
  }
  piezas = [];
  for (let i = 0; i < 4; i += 1) piezas.push(await createPart({ stock: 5 + i * 3, minimumStock: 3 }));
});
afterAll(closePool);

describe('invariante existencia = suma de movimientos', () => {
  test.each([1, 7, 42])('test_secuencia_aleatoria_con_semilla_%i_mantiene_la_invariante', async (semilla) => {
    const azar = generador(semilla);
    const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
    const entero = (min, max) => min + Math.floor(azar() * (max - min + 1));

    for (let paso = 0; paso < 60; paso += 1) {
      const pieza = elegir(piezas);
      const { mecanico, orden } = elegir(ordenes);
      const operacion = Math.floor(azar() * 6);

      if (operacion === 0) {
        await request(app)
          .post(`/api/parts/${pieza.id}/entries`)
          .set('Authorization', admin.auth)
          .send({ quantity: entero(1, 6), reason: 'Compra aleatoria' });
      } else if (operacion === 1) {
        await request(app)
          .post(`/api/parts/${pieza.id}/adjustments`)
          .set('Authorization', admin.auth)
          .send({ newStock: entero(0, 15), reason: 'Conteo aleatorio' });
      } else if (operacion === 2 || operacion === 3) {
        await request(app)
          .post(`/api/orders/${orden.id}/parts`)
          .set('Authorization', mecanico.auth)
          .send({ partId: pieza.id, quantity: entero(1, 5) });
      } else {
        const detalle = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', mecanico.auth);
        const lineas = detalle.body.data.parts;
        if (lineas.length > 0) {
          const linea = elegir(lineas);
          if (operacion === 4) {
            await request(app)
              .patch(`/api/orders/${orden.id}/parts/${linea.id}`)
              .set('Authorization', mecanico.auth)
              .send({ quantity: entero(1, 8) });
          } else {
            await request(app)
              .delete(`/api/orders/${orden.id}/parts/${linea.id}`)
              .set('Authorization', mecanico.auth);
          }
        }
      }

      // Se comprueba después de cada operación, no solo al final.
      const [[{ negativas }]] = await pool.query('SELECT COUNT(*) AS negativas FROM parts WHERE stock < 0');
      expect(negativas).toBe(0);
    }

    await verificarInvariante();
  }, 120000);

  test('test_las_operaciones_rechazadas_no_dejan_rastros', async () => {
    const { mecanico, orden } = ordenes[0];
    const pieza = piezas[0];
    const [[antes]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    const [[{ movimientosAntes }]] = await pool.query('SELECT COUNT(*) AS movimientosAntes FROM inventory_movements');

    const rechazos = await Promise.all([
      request(app).post(`/api/orders/${orden.id}/parts`).set('Authorization', mecanico.auth).send({ partId: pieza.id, quantity: antes.stock + 1 }),
      request(app).post(`/api/orders/${orden.id}/parts`).set('Authorization', mecanico.auth).send({ partId: pieza.id, quantity: 0 }),
      request(app).post(`/api/parts/${pieza.id}/adjustments`).set('Authorization', admin.auth).send({ newStock: antes.stock, reason: 'Sin diferencia' }),
      request(app).post(`/api/parts/${pieza.id}/entries`).set('Authorization', admin.auth).send({ quantity: -2, reason: 'Inválida' })
    ]);

    expect(rechazos.map((r) => r.status)).toEqual([409, 400, 400, 400]);
    const [[despues]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    const [[{ movimientosDespues }]] = await pool.query('SELECT COUNT(*) AS movimientosDespues FROM inventory_movements');
    expect(despues.stock).toBe(antes.stock);
    expect(movimientosDespues).toBe(movimientosAntes);
    await verificarInvariante();
  });

  test('test_la_base_de_datos_impide_la_existencia_negativa_aunque_falle_el_servicio', async () => {
    const pieza = piezas[0];

    await expect(
      pool.query('UPDATE parts SET stock = CAST(stock AS SIGNED) - 1000 WHERE id = ?', [pieza.id])
    ).rejects.toThrow();
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(5);
  });
});
