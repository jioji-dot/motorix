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
  sumaDeMovimientos,
} from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Cancelar una orden con refacciones (integración)', () => {
  test('cancelar_regresa_todas_las_piezas_con_movimientos_que_indican_la_cancelacion', async () => {
    const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
    const a = await crearRefaccion({ stock: 6, salePrice: 10 });
    const b = await crearRefaccion({ stock: 4, salePrice: 20 });
    await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId: b.id, quantity: 3 });
    await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId: a.id, quantity: 5 });

    const cancelada = await request(app)
      .post(`/api/orders/${orden}/status`)
      .set(como('RECEPTIONIST'))
      .send({ status: 'CANCELADA', reason: 'El cliente ya no autorizó la reparación' });
    expect(cancelada.status).toBe(200);
    expect(cancelada.body.data.status).toBe('CANCELADA');
    // La orden conserva sus líneas para la trazabilidad.
    expect(cancelada.body.data.parts).toHaveLength(2);

    for (const [parte, inicial] of [[a, 6], [b, 4]]) {
      const detalle = await request(app).get(`/api/parts/${parte.id}`).set(como('ADMIN'));
      expect(detalle.body.data.stock).toBe(inicial);
      expect(detalle.body.data.movements[0]).toMatchObject({ type: 'IN', orderId: orden });
      expect(detalle.body.data.movements[0].reason).toContain('Cancelación');
      expect(await sumaDeMovimientos(parte.id)).toEqual({ stock: inicial, suma: inicial });
    }
  });

  test('cancelar_una_orden_sin_refacciones_no_crea_movimientos', async () => {
    const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'RECIBIDO' });
    const [[antes]] = await pool.query('SELECT COUNT(*) AS total FROM inventory_movements');
    const respuesta = await request(app).post(`/api/orders/${orden}/status`).set(como('ADMIN')).send({ status: 'CANCELADA', reason: 'Prueba' });
    expect(respuesta.status).toBe(200);
    const [[despues]] = await pool.query('SELECT COUNT(*) AS total FROM inventory_movements');
    expect(despues.total).toBe(antes.total);
  });

  test('la_invariante_stock_igual_a_suma_de_movimientos_se_cumple_en_todas_las_refacciones', async () => {
    const [filas] = await pool.query(
      `SELECT p.id, p.stock, COALESCE(SUM(m.quantity), 0) AS suma
         FROM parts p LEFT JOIN inventory_movements m ON m.partId = p.id GROUP BY p.id`,
    );
    expect(filas.length).toBeGreaterThan(0);
    for (const fila of filas) expect(Number(fila.suma)).toBe(fila.stock);
  });
});
