import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearRefaccion,
  crearSegundoMecanico,
  crearUsuariosDePrueba,
  limpiarBase,
  sumaDeMovimientos,
} from '../helpers.js';

let usuarios;
let mecanico2;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = (status = 'EN_REPARACION', mechanicId) =>
  crearOrden({ ...datos, mechanicId: mechanicId ?? usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status });
const agregar = (orden, partId, quantity, auth = como('MECHANIC')) =>
  request(app).post(`/api/orders/${orden}/parts`).set(auth).send({ partId, quantity });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  mecanico2 = await crearSegundoMecanico();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Refacciones en órdenes (integración)', () => {
  test('agregar_baja_el_stock_crea_la_salida_ligada_a_la_orden_y_suma_el_total', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5, salePrice: 100 });
    const respuesta = await agregar(orden, id, 2);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.total).toBe('200.00');
    const detalle = await request(app).get(`/api/parts/${id}`).set(como('ADMIN'));
    expect(detalle.body.data.stock).toBe(3);
    expect(detalle.body.data.movements[0]).toMatchObject({ type: 'OUT', quantity: -2, stockAfter: 3, orderId: orden });
    expect(detalle.body.data.movements[0].reason).toContain(`OS-${String(orden).padStart(6, '0')}`);
  });

  test('el_total_suma_servicios_mano_de_obra_y_refacciones', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5, salePrice: 50 });
    await request(app).post(`/api/orders/${orden}/services`).set(como('MECHANIC')).send({ description: 'Servicio', amount: 100 });
    await request(app).post(`/api/orders/${orden}/labor`).set(como('MECHANIC')).send({ description: 'Mano', hours: 2, hourlyRate: 30 });
    const respuesta = await agregar(orden, id, 3);
    expect(respuesta.body.data.total).toBe('310.00');
    const quitada = await request(app).delete(`/api/orders/${orden}/parts/${respuesta.body.data.parts[0].id}`).set(como('MECHANIC'));
    expect(quitada.body.data.total).toBe('160.00');
  });

  test('una_cantidad_mayor_a_la_disponible_se_rechaza_sin_cambiar_nada', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 2 });
    const respuesta = await agregar(orden, id, 3);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', available: 2 });
    expect(await sumaDeMovimientos(id)).toEqual({ stock: 2, suma: 2 });
    const detalle = await request(app).get(`/api/orders/${orden}`).set(como('MECHANIC'));
    expect(detalle.body.data.parts).toEqual([]);
  });

  test('diez_peticiones_simultaneas_por_la_ultima_pieza_dejan_exactamente_una_aplicada', async () => {
    const { id } = await crearRefaccion({ stock: 1 });
    const ordenes = await Promise.all(Array.from({ length: 10 }, () => nuevaOrden()));
    const respuestas = await Promise.all(ordenes.map((orden) => agregar(orden, id, 1)));
    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    const rechazos = respuestas.filter((r) => r.status === 409);
    expect(rechazos).toHaveLength(9);
    expect(rechazos.every((r) => r.body.error.code === 'INSUFFICIENT_STOCK')).toBe(true);
    expect(await sumaDeMovimientos(id)).toEqual({ stock: 0, suma: 0 });
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM order_parts WHERE partId = ?', [id]);
    expect(total).toBe(1);
  });

  test('dos_mecanicos_usando_la_ultima_pieza_a_la_vez_solo_uno_lo_logra', async () => {
    const { id } = await crearRefaccion({ stock: 1 });
    const a = await nuevaOrden();
    const b = await nuevaOrden('EN_REPARACION', mecanico2.id);
    const [ra, rb] = await Promise.all([agregar(a, id, 1), agregar(b, id, 1, { Authorization: `Bearer ${mecanico2.token}` })]);
    expect([ra.status, rb.status].sort()).toEqual([201, 409]);
  });

  test('el_precio_de_la_orden_no_cambia_si_cambia_el_catalogo', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5, salePrice: 100, name: 'Pieza congelada' });
    await agregar(orden, id, 2);
    await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ salePrice: 999, name: 'Renombrada' });
    const detalle = await request(app).get(`/api/orders/${orden}`).set(como('MECHANIC'));
    expect(detalle.body.data.total).toBe('200.00');
    expect(detalle.body.data.parts[0]).toMatchObject({ unitPrice: '100.00', name: 'Pieza congelada' });
    const otra = await nuevaOrden();
    const nueva = await agregar(otra, id, 1);
    expect(nueva.body.data.parts[0].unitPrice).toBe('999.00');
  });

  test('editar_la_cantidad_registra_la_diferencia_y_quitar_regresa_las_piezas', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10 });
    const alta = await agregar(orden, id, 4);
    const lineId = alta.body.data.parts[0].id;
    await request(app).patch(`/api/orders/${orden}/parts/${lineId}`).set(como('MECHANIC')).send({ quantity: 6 });
    expect((await request(app).get(`/api/parts/${id}`).set(como('ADMIN'))).body.data.stock).toBe(4);
    await request(app).patch(`/api/orders/${orden}/parts/${lineId}`).set(como('MECHANIC')).send({ quantity: 1 });
    expect((await request(app).get(`/api/parts/${id}`).set(como('ADMIN'))).body.data.stock).toBe(9);
    await request(app).delete(`/api/orders/${orden}/parts/${lineId}`).set(como('MECHANIC'));
    const final = await request(app).get(`/api/parts/${id}`).set(como('ADMIN'));
    expect(final.body.data.stock).toBe(10);
    expect(final.body.data.movements.map((m) => m.quantity)).toEqual([1, 5, -2, -4, 10]);
    expect(await sumaDeMovimientos(id)).toEqual({ stock: 10, suma: 10 });
  });

  test('aumentar_mas_de_lo_disponible_se_rechaza_y_conserva_la_cantidad_anterior', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 3 });
    const alta = await agregar(orden, id, 2);
    const lineId = alta.body.data.parts[0].id;
    const respuesta = await request(app).patch(`/api/orders/${orden}/parts/${lineId}`).set(como('MECHANIC')).send({ quantity: 6 });
    expect(respuesta.status).toBe(409);
    const detalle = await request(app).get(`/api/orders/${orden}`).set(como('MECHANIC'));
    expect(detalle.body.data.parts[0].quantity).toBe(2);
  });

  test('las_ordenes_cerradas_rechazan_cambios_y_otro_mecanico_o_recepcion_no_pueden_agregar', async () => {
    const { id } = await crearRefaccion({ stock: 5 });
    for (const status of ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      const orden = await nuevaOrden(status);
      const r = await agregar(orden, id, 1);
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('ORDER_NOT_EDITABLE');
    }
    const orden = await nuevaOrden();
    expect((await agregar(orden, id, 1, { Authorization: `Bearer ${mecanico2.token}` })).status).toBe(403);
    expect((await agregar(orden, id, 1, como('RECEPTIONIST'))).status).toBe(403);
    expect(await sumaDeMovimientos(id)).toEqual({ stock: 5, suma: 5 });
  });

  test('una_refaccion_desactivada_no_se_ofrece_para_nuevas_ordenes_pero_conserva_las_existentes', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5 });
    await agregar(orden, id, 1);
    await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ active: false });
    const otra = await nuevaOrden();
    expect((await agregar(otra, id, 1)).body.error.code).toBe('PART_INACTIVE');
    const detalle = await request(app).get(`/api/orders/${orden}`).set(como('MECHANIC'));
    expect(detalle.body.data.parts).toHaveLength(1);
  });

  test('la_base_impide_dos_lineas_de_la_misma_refaccion_en_una_orden', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5 });
    await agregar(orden, id, 1);
    await expect(
      pool.execute("INSERT INTO order_parts (orderId, partId, partCode, partName, quantity, unitPrice) VALUES (?, ?, 'x', 'x', 1, 1)", [orden, id]),
    ).rejects.toThrow();
  });
});
