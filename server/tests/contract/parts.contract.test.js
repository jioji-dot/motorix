// Contrato de /api/parts (specs/003-.../contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nueva = (extra = {}) => ({
  code: 'CTR-001',
  name: 'Balata delantera',
  category: 'Frenos',
  brand: 'Brembo',
  minimumStock: 3,
  purchasePrice: 300,
  salePrice: 450,
  ...extra,
});

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('POST /api/parts', () => {
  test('responde_201_con_la_refaccion_y_su_movimiento_de_existencia_inicial', async () => {
    const respuesta = await request(app).post('/api/parts').set(como('ADMIN')).send(nueva({ initialStock: 6 }));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      id: expect.any(Number),
      code: 'CTR-001',
      name: 'Balata delantera',
      category: 'Frenos',
      brand: 'Brembo',
      stock: 6,
      minimumStock: 3,
      stockLevel: 'OK',
      purchasePrice: '300.00',
      salePrice: '450.00',
      active: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const detalle = await request(app).get(`/api/parts/${respuesta.body.data.id}`).set(como('ADMIN'));
    expect(detalle.body.data.movements).toEqual([
      expect.objectContaining({ type: 'IN', quantity: 6, stockAfter: 6, reason: 'Existencia inicial' }),
    ]);
  });

  test('responde_409_DUPLICATE_VALUE_con_el_campo_code_y_400_con_datos_invalidos', async () => {
    const repetida = await request(app).post('/api/parts').set(como('ADMIN')).send(nueva({ code: 'ctr-001' }));
    expect(repetida.status).toBe(409);
    expect(repetida.body).toEqual({
      error: { code: 'DUPLICATE_VALUE', message: expect.any(String), details: [{ field: 'code', message: expect.any(String) }] },
    });
    const mala = await request(app).post('/api/parts').set(como('ADMIN')).send({});
    expect(mala.status).toBe(400);
    expect(mala.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/parts y GET /api/parts/:id', () => {
  test('el_listado_responde_200_con_data_y_meta_y_el_detalle_404_si_no_existe', async () => {
    await crearRefaccion({ name: 'Zeta' });
    const lista = await request(app).get('/api/parts').set(como('MECHANIC'));
    expect(lista.status).toBe(200);
    expect(lista.body.meta).toEqual({ page: 1, pageSize: 20, total: expect.any(Number) });
    expect(lista.body.data[0]).toHaveProperty('stockLevel');
    const no = await request(app).get('/api/parts/999999').set(como('ADMIN'));
    expect(no.status).toBe(404);
    expect(no.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('GET_categories_devuelve_las_categorias_disponibles', async () => {
    const respuesta = await request(app).get('/api/parts/categories').set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual(expect.arrayContaining(['Frenos']));
  });

  test('el_detalle_incluye_movements_con_el_usuario_que_los_registro', async () => {
    const { id } = await crearRefaccion({ stock: 4 });
    const respuesta = await request(app).get(`/api/parts/${id}`).set(como('RECEPTIONIST'));
    expect(respuesta.body.data.movements[0]).toMatchObject({
      id: expect.any(Number),
      type: 'IN',
      quantity: 4,
      stockAfter: 4,
      orderId: null,
      orderFolio: null,
      createdBy: { id: expect.any(Number), name: expect.any(String) },
      createdAt: expect.any(String),
    });
  });
});

describe('PATCH /api/parts/:id', () => {
  test('responde_200_ignora_el_stock_y_el_codigo_enviados', async () => {
    const { id, code } = await crearRefaccion({ stock: 3 });
    const respuesta = await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ name: 'Renombrada', stock: 999, code: 'OTRO' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ name: 'Renombrada', stock: 3, code });
  });

  test('responde_400_sin_campos_y_404_si_no_existe', async () => {
    const { id } = await crearRefaccion();
    expect((await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({})).status).toBe(400);
    expect((await request(app).patch('/api/parts/999999').set(como('ADMIN')).send({ name: 'x' })).status).toBe(404);
  });
});

describe('Movimientos: POST y GET /api/parts/:id/movements', () => {
  test('POST_responde_201_con_movement_y_part_actualizada', async () => {
    const { id } = await crearRefaccion({ stock: 5 });
    const respuesta = await request(app)
      .post(`/api/parts/${id}/movements`)
      .set(como('ADMIN'))
      .send({ type: 'OUT', quantity: 2, reason: 'Merma por humedad' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.movement).toMatchObject({ type: 'OUT', quantity: -2, stockAfter: 3, reason: 'Merma por humedad' });
    expect(respuesta.body.data.part).toMatchObject({ id, stock: 3 });
  });

  test('POST_responde_409_INSUFFICIENT_STOCK_con_available_y_400_con_datos_invalidos', async () => {
    const { id } = await crearRefaccion({ stock: 2 });
    const corto = await request(app).post(`/api/parts/${id}/movements`).set(como('ADMIN')).send({ type: 'ADJUSTMENT', quantity: -3, reason: 'Conteo' });
    expect(corto.status).toBe(409);
    expect(corto.body).toEqual({ error: { code: 'INSUFFICIENT_STOCK', message: expect.any(String), available: 2 } });
    const mal = await request(app).post(`/api/parts/${id}/movements`).set(como('ADMIN')).send({ type: 'IN', quantity: 0, reason: '' });
    expect(mal.status).toBe(400);
    expect(mal.body.error.details.map((d) => d.field).sort()).toEqual(['quantity', 'reason']);
    expect((await request(app).post('/api/parts/999999/movements').set(como('ADMIN')).send({ type: 'IN', quantity: 1, reason: 'x' })).status).toBe(404);
  });

  test('GET_lista_los_movimientos_paginados_del_mas_reciente_al_mas_antiguo', async () => {
    const { id } = await crearRefaccion({ stock: 1 });
    await request(app).post(`/api/parts/${id}/movements`).set(como('ADMIN')).send({ type: 'IN', quantity: 4, reason: 'Compra' });
    const respuesta = await request(app).get(`/api/parts/${id}/movements?pageSize=1`).set(como('MECHANIC'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 1, total: 2 });
    expect(respuesta.body.data[0]).toMatchObject({ type: 'IN', quantity: 4, stockAfter: 5 });
  });
});
