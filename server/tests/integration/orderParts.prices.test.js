// El precio de una refacción queda guardado en la línea al agregarla (Sprint 5, FR-010, FR-014 y FR-020).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
const agregar = (orden, partId, quantity) => request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId, quantity });
const cambiarPrecio = (partId, salePrice) => request(app).patch(`/api/parts/${partId}`).set(como('ADMIN')).send({ salePrice });
const detalle = async (orden) => (await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'))).body.data;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Precio guardado en la línea de la orden (integración, Sprint 5)', () => {
  test('un_cambio_posterior_del_precio_no_modifica_la_linea_su_importe_ni_el_total', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 100, salePrice: 180 });
    expect((await agregar(orden, id, 2)).status).toBe(201);
    const antes = await detalle(orden);
    expect(antes.parts[0]).toMatchObject({ unitPrice: '180.00', amount: '360.00' });

    expect((await cambiarPrecio(id, 250)).status).toBe(200);
    const despues = await detalle(orden);
    expect(despues.parts[0]).toMatchObject({ unitPrice: '180.00', amount: '360.00' });
    expect(despues.total).toBe(antes.total);
  });

  test('una_linea_agregada_despues_del_cambio_toma_el_precio_nuevo', async () => {
    const primera = await nuevaOrden();
    const segunda = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 100, salePrice: 180 });
    await agregar(primera, id, 1);
    await cambiarPrecio(id, 250);
    await agregar(segunda, id, 1);
    expect((await detalle(primera)).parts[0].unitPrice).toBe('180.00');
    expect((await detalle(segunda)).parts[0].unitPrice).toBe('250.00');
    expect((await detalle(segunda)).total).toBe('250.00');
  });

  test('la_misma_refaccion_dos_veces_se_rechaza_y_el_precio_se_corrige_quitando_y_agregando_de_nuevo', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 100, salePrice: 180 });
    const alta = await agregar(orden, id, 1);
    expect(alta.status).toBe(201);
    await cambiarPrecio(id, 260);

    const repetida = await agregar(orden, id, 1);
    expect(repetida.status).toBe(409);
    expect(repetida.body.error.code).toBe('DUPLICATE_ORDER_PART');
    expect((await detalle(orden)).parts[0].unitPrice).toBe('180.00');

    const lineId = alta.body.data.parts[0].id;
    expect((await request(app).delete(`/api/orders/${orden}/parts/${lineId}`).set(como('ADMIN'))).status).toBe(200);
    expect((await agregar(orden, id, 1)).status).toBe(201);
    const corregida = await detalle(orden);
    expect(corregida.parts).toHaveLength(1);
    expect(corregida.parts[0].unitPrice).toBe('260.00');
    expect(corregida.total).toBe('260.00');
  });

  test('el_unico_cambio_de_una_linea_ya_agregada_es_la_cantidad_y_conserva_su_precio', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 100, salePrice: 180 });
    const alta = await agregar(orden, id, 1);
    await cambiarPrecio(id, 400);
    const lineId = alta.body.data.parts[0].id;
    const cambio = await request(app).patch(`/api/orders/${orden}/parts/${lineId}`).set(como('ADMIN')).send({ quantity: 3, unitPrice: 1 });
    expect(cambio.status).toBe(200);
    const despues = await detalle(orden);
    expect(despues.parts[0]).toMatchObject({ quantity: 3, unitPrice: '180.00', amount: '540.00' });
    expect(despues.total).toBe('540.00');
  });

  test('una_refaccion_desactivada_conserva_el_precio_de_sus_lineas_y_no_se_agrega_a_ordenes_nuevas', async () => {
    const vieja = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 100, salePrice: 180 });
    await agregar(vieja, id, 2);
    const desactivada = await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ active: false });
    expect(desactivada.status).toBe(200);

    expect((await detalle(vieja)).parts[0]).toMatchObject({ unitPrice: '180.00', amount: '360.00' });
    const nueva = await nuevaOrden();
    const rechazo = await agregar(nueva, id, 1);
    expect(rechazo.status).toBe(409);
    expect(rechazo.body.error.code).toBe('PART_INACTIVE');
  });
});
