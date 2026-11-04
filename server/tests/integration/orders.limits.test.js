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
const nuevaOrden = () =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
const agregarParte = (orden, partId, quantity) =>
  request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId, quantity });
const agregarServicio = (orden, amount) =>
  request(app).post(`/api/orders/${orden}/services`).set(como('ADMIN')).send({ description: 'Servicio', amount });
const agregarManoDeObra = (orden, hours, hourlyRate) =>
  request(app).post(`/api/orders/${orden}/labor`).set(como('ADMIN')).send({ description: 'Mano de obra', hours, hourlyRate });

// Estado observable de una orden y de una refacción para comprobar que un rechazo no cambia nada.
async function estado(orden, partId) {
  const detalle = (await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'))).body.data;
  const [[{ movimientos }]] = await pool.query('SELECT COUNT(*) AS movimientos FROM inventory_movements WHERE partId = ?', [partId]);
  return {
    total: detalle.total,
    lineas: [detalle.services.length, detalle.labor.length, detalle.parts.length],
    movimientos,
    stock: (await sumaDeMovimientos(partId)).stock,
  };
}

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Límite de 99,999,999.99 en líneas y totales (integración, Sprint 5)', () => {
  test('una_linea_de_refaccion_con_importe_mayor_al_maximo_responde_409_y_no_cambia_nada', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 1, salePrice: 99999999.99 });
    const antes = await estado(orden, id);
    const respuesta = await agregarParte(orden, id, 2);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({ code: 'AMOUNT_LIMIT_EXCEEDED', details: [{ field: 'quantity' }] });
    expect(respuesta.body.error.message).toContain('99,999,999.99');
    expect(await estado(orden, id)).toEqual(antes);
  });

  test('un_total_exacto_de_99999999_99_se_acepta', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, salePrice: 99999999.99 });
    const respuesta = await agregarParte(orden, id, 1);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.total).toBe('99999999.99');
  });

  test('un_servicio_o_una_mano_de_obra_que_haria_pasar_el_total_del_maximo_se_rechaza', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, salePrice: 99999999.99 });
    await agregarParte(orden, id, 1);
    const antes = await estado(orden, id);

    const servicio = await agregarServicio(orden, 0.01);
    expect(servicio.status).toBe(409);
    expect(servicio.body.error.code).toBe('AMOUNT_LIMIT_EXCEEDED');

    const manoDeObra = await agregarManoDeObra(orden, 0.01, 1);
    expect(manoDeObra.status).toBe(409);
    expect(manoDeObra.body.error.code).toBe('AMOUNT_LIMIT_EXCEEDED');

    expect(await estado(orden, id)).toEqual(antes);
  });

  test('cambiar_la_cantidad_de_una_linea_por_encima_del_maximo_se_rechaza_y_conserva_cantidad_y_stock', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5, salePrice: 50000000 });
    const alta = await agregarParte(orden, id, 1);
    expect(alta.status).toBe(201);
    const lineId = alta.body.data.parts[0].id;
    const antes = await estado(orden, id);

    const cambio = await request(app).patch(`/api/orders/${orden}/parts/${lineId}`).set(como('ADMIN')).send({ quantity: 2 });
    expect(cambio.status).toBe(409);
    expect(cambio.body.error.code).toBe('AMOUNT_LIMIT_EXCEEDED');
    expect(await estado(orden, id)).toEqual(antes);
    const detalle = await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'));
    expect(detalle.body.data.parts[0]).toMatchObject({ quantity: 1, amount: '50000000.00' });
  });

  test('cambiar_el_importe_de_un_servicio_que_subiria_el_total_del_maximo_se_rechaza', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5, salePrice: 10 });
    await agregarParte(orden, id, 1);
    const servicio = await agregarServicio(orden, 99999989.99);
    expect(servicio.status).toBe(201);
    expect(servicio.body.data.total).toBe('99999999.99');
    const lineId = servicio.body.data.services[0].id;

    const cambio = await request(app).patch(`/api/orders/${orden}/services/${lineId}`).set(como('ADMIN')).send({ amount: 99999990 });
    expect(cambio.status).toBe(409);
    expect(cambio.body.error.code).toBe('AMOUNT_LIMIT_EXCEEDED');
    const detalle = await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'));
    expect(detalle.body.data.services[0].amount).toBe('99999989.99');
  });

  test('una_mano_de_obra_cuyo_importe_por_si_solo_no_cabe_responde_409_y_no_guarda_la_linea', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 1 });
    const antes = await estado(orden, id);
    const respuesta = await agregarManoDeObra(orden, 999.99, 99999999.99);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('AMOUNT_LIMIT_EXCEEDED');
    expect(await estado(orden, id)).toEqual(antes);
  });

  test('reducir_o_quitar_lineas_nunca_se_rechaza_por_el_limite', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5, salePrice: 99999999.99 });
    const alta = await agregarParte(orden, id, 1);
    const quitada = await request(app).delete(`/api/orders/${orden}/parts/${alta.body.data.parts[0].id}`).set(como('ADMIN'));
    expect(quitada.status).toBe(200);
    expect(quitada.body.data.total).toBe('0.00');
  });
});
