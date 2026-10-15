// Pruebas de concurrencia del inventario (US7, FR-023, SC-007) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createPart } from '../helpers/factories.js';

const app = createApp();

const agregar = (auth, id, cuerpo) =>
  request(app).post(`/api/orders/${id}/parts`).set('Authorization', auth).send(cuerpo);

async function mecanicoConOrden() {
  const mecanico = await createAuthenticated('MECHANIC');
  const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });
  return { ...mecanico, orden };
}

async function expectInvariante() {
  const [filas] = await pool.query(
    `SELECT p.id, p.stock, COALESCE(SUM(m.quantity), 0) AS suma
     FROM parts p LEFT JOIN inventory_movements m ON m.part_id = p.id GROUP BY p.id`
  );
  for (const fila of filas) expect(Number(fila.suma)).toBe(fila.stock);
}

beforeEach(cleanTables);
afterAll(closePool);

describe('uso simultáneo de una refacción', () => {
  test('test_dos_solicitudes_por_la_ultima_pieza_solo_una_se_acepta', async () => {
    const pieza = await createPart({ stock: 1, minimumStock: 0 });
    const a = await mecanicoConOrden();
    const b = await mecanicoConOrden();

    const [ra, rb] = await Promise.all([
      agregar(a.auth, a.orden.id, { partId: pieza.id, quantity: 1 }),
      agregar(b.auth, b.orden.id, { partId: pieza.id, quantity: 1 })
    ]);

    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const perdedora = ra.status === 409 ? ra : rb;
    expect(perdedora.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(perdedora.body.error.details.available).toBe(0);
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(0);
    await expectInvariante();
  });

  test('test_una_rafaga_de_solicitudes_asigna_exactamente_la_existencia_disponible', async () => {
    const existencia = 3;
    const solicitudes = 8;
    const pieza = await createPart({ stock: existencia, minimumStock: 0 });
    const mecanicos = [];
    for (let i = 0; i < solicitudes; i += 1) mecanicos.push(await mecanicoConOrden());

    const respuestas = await Promise.all(
      mecanicos.map((m) => agregar(m.auth, m.orden.id, { partId: pieza.id, quantity: 1 }))
    );

    const aceptadas = respuestas.filter((r) => r.status === 200).length;
    const rechazadas = respuestas.filter((r) => r.status === 409).length;
    expect(aceptadas).toBe(existencia);
    expect(rechazadas).toBe(solicitudes - existencia);
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(0);
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM inventory_movements WHERE type = 'OUT'"
    );
    expect(total).toBe(existencia);
    await expectInvariante();
  });

  test('test_dos_mecanicos_con_cantidades_mayores_nunca_dejan_la_existencia_negativa', async () => {
    const pieza = await createPart({ stock: 5, minimumStock: 0 });
    const a = await mecanicoConOrden();
    const b = await mecanicoConOrden();

    const [ra, rb] = await Promise.all([
      agregar(a.auth, a.orden.id, { partId: pieza.id, quantity: 3 }),
      agregar(b.auth, b.orden.id, { partId: pieza.id, quantity: 3 })
    ]);

    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(2);
    await expectInvariante();
  });

  test('test_agregar_en_paralelo_a_la_misma_orden_suma_las_cantidades_en_una_sola_linea', async () => {
    const pieza = await createPart({ stock: 10, minimumStock: 0 });
    const m = await mecanicoConOrden();

    const respuestas = await Promise.all(
      [1, 2, 3].map(() => agregar(m.auth, m.orden.id, { partId: pieza.id, quantity: 2 }))
    );

    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200]);
    const [lineas] = await pool.query('SELECT quantity FROM order_parts WHERE order_id = ?', [m.orden.id]);
    expect(lineas).toEqual([{ quantity: 6 }]);
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(4);
    await expectInvariante();
  });

  test('test_un_ajuste_del_administrador_simultaneo_a_un_uso_mantiene_la_invariante', async () => {
    const pieza = await createPart({ stock: 4, minimumStock: 0 });
    const m = await mecanicoConOrden();
    const admin = await createAuthenticated('ADMIN');

    const [uso, ajuste] = await Promise.all([
      agregar(m.auth, m.orden.id, { partId: pieza.id, quantity: 2 }),
      request(app)
        .post(`/api/parts/${pieza.id}/entries`)
        .set('Authorization', admin.auth)
        .send({ quantity: 5, reason: 'Compra' })
    ]);

    expect(uso.status).toBe(200);
    expect(ajuste.status).toBe(201);
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(7);
    await expectInvariante();
  });
});
