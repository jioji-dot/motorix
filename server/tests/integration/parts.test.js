import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearRefaccion, crearUsuariosDePrueba, limpiarBase, sumaDeMovimientos } from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const mover = (id, cuerpo, rol = 'ADMIN') => request(app).post(`/api/parts/${id}/movements`).set(como(rol)).send(cuerpo);

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('Inventario (integración)', () => {
  test('solo_el_administrador_escribe_y_los_demas_roles_reciben_403', async () => {
    const { id } = await crearRefaccion();
    const cuerpo = { code: 'X-1', name: 'x', category: 'x', brand: 'x', minimumStock: 1, purchasePrice: 1, salePrice: 2 };
    for (const rol of ['MECHANIC', 'RECEPTIONIST']) {
      expect((await request(app).post('/api/parts').set(como(rol)).send(cuerpo)).status).toBe(403);
      expect((await request(app).patch(`/api/parts/${id}`).set(como(rol)).send({ name: 'y' })).status).toBe(403);
      expect((await mover(id, { type: 'IN', quantity: 1, reason: 'x' }, rol)).status).toBe(403);
      expect((await request(app).get(`/api/parts/${id}`).set(como(rol))).status).toBe(200);
    }
  });

  test('entrada_salida_y_ajuste_actualizan_el_stock_y_quedan_con_usuario_y_fecha', async () => {
    const { id } = await crearRefaccion({ stock: 10 });
    await mover(id, { type: 'IN', quantity: 5, reason: 'Compra' });
    await mover(id, { type: 'OUT', quantity: 3, reason: 'Merma' });
    const ajuste = await mover(id, { type: 'ADJUSTMENT', quantity: -4, reason: 'Conteo físico' });
    expect(ajuste.body.data.part.stock).toBe(8);
    const detalle = await request(app).get(`/api/parts/${id}`).set(como('ADMIN'));
    expect(detalle.body.data.stock).toBe(8);
    expect(detalle.body.data.movements.map((m) => [m.type, m.quantity, m.stockAfter])).toEqual([
      ['ADJUSTMENT', -4, 8],
      ['OUT', -3, 12],
      ['IN', 5, 15],
      ['IN', 10, 10],
    ]);
    expect(detalle.body.data.movements[0].createdBy).toEqual({ id: usuarios.ADMIN.id, name: usuarios.ADMIN.name });
    expect(await sumaDeMovimientos(id)).toEqual({ stock: 8, suma: 8 });
  });

  test('un_movimiento_que_dejaria_el_stock_negativo_se_rechaza_sin_cambios', async () => {
    const { id } = await crearRefaccion({ stock: 3 });
    for (const cuerpo of [
      { type: 'OUT', quantity: 4, reason: 'x' },
      { type: 'ADJUSTMENT', quantity: -4, reason: 'x' },
    ]) {
      const respuesta = await mover(id, cuerpo);
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', available: 3 });
    }
    expect(await sumaDeMovimientos(id)).toEqual({ stock: 3, suma: 3 });
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM inventory_movements WHERE partId = ?', [id]);
    expect(total).toBe(1);
  });

  test('los_movimientos_son_inmutables_no_hay_rutas_para_editarlos_o_borrarlos', async () => {
    const { id } = await crearRefaccion({ stock: 2 });
    const [[movimiento]] = await pool.query('SELECT id FROM inventory_movements WHERE partId = ?', [id]);
    for (const metodo of ['patch', 'put', 'delete']) {
      const r = await request(app)[metodo](`/api/parts/${id}/movements/${movimiento.id}`).set(como('ADMIN')).send({ quantity: 9 });
      expect(r.status).toBe(404);
    }
    expect((await request(app).delete(`/api/parts/${id}`).set(como('ADMIN'))).status).toBe(404);
  });

  test('la_base_rechaza_stock_negativo_y_movimientos_incoherentes_aunque_falle_la_logica', async () => {
    const { id } = await crearRefaccion({ stock: 1 });
    await expect(pool.execute('UPDATE parts SET stock = stock - 2 WHERE id = ?', [id])).rejects.toThrow();
    await expect(
      pool.execute("INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, createdBy) VALUES (?, 'OUT', 5, 1, 'x', ?)", [id, usuarios.ADMIN.id]),
    ).rejects.toThrow();
    await expect(
      pool.execute("INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, createdBy) VALUES (?, 'ADJUSTMENT', 0, 1, 'x', ?)", [id, usuarios.ADMIN.id]),
    ).rejects.toThrow();
  });

  test('el_precio_de_compra_no_aparece_en_ninguna_respuesta_para_mecanico_y_recepcion', async () => {
    const { id } = await crearRefaccion({ purchasePrice: 77 });
    for (const rol of ['MECHANIC', 'RECEPTIONIST']) {
      const respuestas = [
        await request(app).get('/api/parts').set(como(rol)),
        await request(app).get(`/api/parts/${id}`).set(como(rol)),
        await request(app).get(`/api/parts/${id}/movements`).set(como(rol)),
      ];
      for (const r of respuestas) {
        expect(r.status).toBe(200);
        expect(JSON.stringify(r.body)).not.toMatch(/purchasePrice|77\.00/);
      }
    }
    const admin = await request(app).get(`/api/parts/${id}`).set(como('ADMIN'));
    expect(admin.body.data.purchasePrice).toBe('77.00');
  });

  test('desactivar_oculta_la_refaccion_a_los_demas_roles_sin_perder_su_historial_y_reactivar_la_devuelve', async () => {
    const { id } = await crearRefaccion({ stock: 2 });
    await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ active: false });
    expect((await request(app).get(`/api/parts/${id}`).set(como('MECHANIC'))).status).toBe(404);
    const admin = await request(app).get(`/api/parts/${id}`).set(como('ADMIN'));
    expect(admin.body.data).toMatchObject({ active: false, stockLevel: null });
    expect(admin.body.data.movements).toHaveLength(1);
    const lista = await request(app).get('/api/parts?pageSize=100').set(como('MECHANIC'));
    expect(lista.body.data.find((p) => p.id === id)).toBeUndefined();
    const adminLista = await request(app).get('/api/parts?active=false&pageSize=100').set(como('ADMIN'));
    expect(adminLista.body.data.map((p) => p.id)).toContain(id);
    await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ active: true });
    expect((await request(app).get(`/api/parts/${id}`).set(como('MECHANIC'))).status).toBe(200);
  });

  test('busca_por_codigo_nombre_categoria_o_marca_y_filtra_por_categoria', async () => {
    await crearRefaccion({ name: 'Amortiguador trasero XYZ', category: 'Suspensión' });
    const nombre = await request(app).get('/api/parts?search=xyz').set(como('ADMIN'));
    expect(nombre.body.data).toHaveLength(1);
    const categoria = await request(app).get('/api/parts?category=Suspensión').set(como('ADMIN'));
    expect(categoria.body.data.every((p) => p.category === 'Suspensión')).toBe(true);
    const marca = await request(app).get('/api/parts?search=Marca%20de%20prueba&pageSize=2').set(como('ADMIN'));
    expect(marca.body.data).toHaveLength(2);
  });

  test('treinta_movimientos_simultaneos_mantienen_stock_igual_a_la_suma_de_movimientos', async () => {
    const { id } = await crearRefaccion({ stock: 20 });
    const peticiones = [];
    for (let i = 0; i < 30; i += 1) {
      peticiones.push(mover(id, i % 3 === 0 ? { type: 'OUT', quantity: 2, reason: `salida ${i}` } : { type: 'IN', quantity: 1, reason: `entrada ${i}` }));
    }
    await Promise.all(peticiones);
    const { stock, suma } = await sumaDeMovimientos(id);
    expect(stock).toBe(suma);
    expect(stock).toBeGreaterThanOrEqual(0);
  });
});
