// Pruebas de integración del catálogo de refacciones (US5) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createPart } from '../helpers/factories.js';

const app = createApp();

const crear = (auth, cuerpo) => request(app).post('/api/parts').set('Authorization', auth).send(cuerpo);
const editar = (auth, id, cuerpo) =>
  request(app).patch(`/api/parts/${id}`).set('Authorization', auth).send(cuerpo);
const listar = (auth, consulta = '') => request(app).get(`/api/parts${consulta}`).set('Authorization', auth);

const movimientosDe = async (partId) => {
  const [filas] = await pool.query(
    'SELECT type, quantity, reason, order_id FROM inventory_movements WHERE part_id = ? ORDER BY id',
    [partId]
  );
  return filas;
};

let auth;

beforeEach(async () => {
  await cleanTables();
  ({ auth } = await createAuthenticated('ADMIN'));
});
afterAll(closePool);

describe('alta de refacciones', () => {
  test('test_el_alta_con_existencia_inicial_registra_un_movimiento_de_entrada', async () => {
    const res = await crear(auth, { code: 'FIL-01', name: 'Filtro de aceite', price: 120, minimumStock: 2, initialStock: 15 });

    expect(res.status).toBe(201);
    expect(res.body.data.stock).toBe(15);
    expect(await movimientosDe(res.body.data.id)).toEqual([
      expect.objectContaining({ type: 'IN', quantity: 15, reason: 'Existencia inicial', order_id: null })
    ]);
  });

  test('test_el_alta_sin_existencia_inicial_no_genera_movimientos', async () => {
    const res = await crear(auth, { code: 'FIL-02', name: 'Filtro de aire', price: 90 });

    expect(res.status).toBe(201);
    expect(res.body.data.stock).toBe(0);
    expect(res.body.data.minimumStock).toBe(0);
    expect(res.body.data.stockStatus).toBe('OUT');
    expect(await movimientosDe(res.body.data.id)).toHaveLength(0);
  });

  test('test_el_codigo_se_normaliza_a_mayusculas_sin_espacios_al_borde', async () => {
    const res = await crear(auth, { code: '  bal-01  ', name: 'Balatas', price: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('BAL-01');
  });

  test('test_el_codigo_duplicado_se_rechaza_sin_distinguir_mayusculas', async () => {
    await createPart({ code: 'ABC-1' });

    const res = await crear(auth, { code: 'abc-1', name: 'Otra', price: 10 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PART_CODE_DUPLICATE');
  });

  test.each([
    ['precio negativo', { price: -1 }, 'price'],
    ['precio con tres decimales', { price: 10.123 }, 'price'],
    ['minimo negativo', { minimumStock: -1 }, 'minimumStock'],
    ['minimo no entero', { minimumStock: 1.5 }, 'minimumStock'],
    ['existencia inicial no entera', { initialStock: 2.5 }, 'initialStock'],
    ['existencia inicial negativa', { initialStock: -3 }, 'initialStock'],
    ['nombre vacio', { name: '   ' }, 'name'],
    ['codigo demasiado largo', { code: 'X'.repeat(41) }, 'code'],
    ['descripcion demasiado larga', { description: 'x'.repeat(501) }, 'description']
  ])('test_rechaza_%s', async (_nombre, cambio, campo) => {
    const res = await crear(auth, { code: 'OK-1', name: 'Pieza', price: 10, ...cambio });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });

  test('test_faltan_campos_obligatorios', async () => {
    const res = await crear(auth, {});

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['code', 'name', 'price']);
  });
});

describe('edición de refacciones', () => {
  test('test_la_edicion_cambia_nombre_descripcion_precio_y_minimo_sin_tocar_la_existencia', async () => {
    const pieza = await createPart({ stock: 7, price: 100, minimumStock: 2 });

    const res = await editar(auth, pieza.id, { name: 'Nuevo', description: 'Detalle', price: 150.5, minimumStock: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ name: 'Nuevo', description: 'Detalle', price: 150.5, minimumStock: 5, stock: 7 })
    );
    expect(await movimientosDe(pieza.id)).toHaveLength(1);
  });

  test('test_la_edicion_no_acepta_modificar_la_existencia', async () => {
    const pieza = await createPart({ stock: 7 });

    const res = await editar(auth, pieza.id, { stock: 100 });

    expect(res.status).toBe(400);
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(7);
  });

  test('test_la_edicion_sin_campos_se_rechaza', async () => {
    const pieza = await createPart();

    const res = await editar(auth, pieza.id, {});

    expect(res.status).toBe(400);
  });

  test('test_cambiar_el_codigo_a_uno_existente_se_rechaza_y_a_uno_propio_se_permite', async () => {
    const a = await createPart({ code: 'AAA' });
    await createPart({ code: 'BBB' });

    const repetido = await editar(auth, a.id, { code: 'bbb' });
    const propio = await editar(auth, a.id, { code: 'aaa', name: 'Mismo código' });

    expect(repetido.status).toBe(409);
    expect(propio.status).toBe(200);
  });

  test('test_editar_una_refaccion_inexistente_responde_404', async () => {
    const res = await editar(auth, 9999, { name: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('consulta y búsqueda', () => {
  test('test_busca_por_nombre_o_por_codigo_y_ordena_por_nombre', async () => {
    await createPart({ code: 'FIL-01', name: 'Filtro de aceite' });
    await createPart({ code: 'BAL-01', name: 'Balatas delanteras' });
    await createPart({ code: 'ACE-5W30', name: 'Aceite 5W30' });

    const porNombre = await listar(auth, '?search=aceite');
    const porCodigo = await listar(auth, '?search=bal-0');
    const todas = await listar(auth);

    expect(porNombre.body.data.map((p) => p.code)).toEqual(['ACE-5W30', 'FIL-01']);
    expect(porCodigo.body.data.map((p) => p.code)).toEqual(['BAL-01']);
    expect(todas.body.data.map((p) => p.name)).toEqual(['Aceite 5W30', 'Balatas delanteras', 'Filtro de aceite']);
  });

  test('test_la_busqueda_trata_los_comodines_como_texto_literal', async () => {
    await createPart({ code: 'A%B', name: 'Con porcentaje' });
    await createPart({ code: 'AXB', name: 'Sin porcentaje' });

    const res = await listar(auth, '?search=A%25B');

    expect(res.body.data.map((p) => p.code)).toEqual(['A%B']);
  });

  test('test_filtra_por_activas_e_inactivas', async () => {
    await createPart({ code: 'ACT', active: 1 });
    await createPart({ code: 'INA', active: 0 });

    const activas = await listar(auth, '?active=true');
    const inactivas = await listar(auth, '?active=false');
    const ambas = await listar(auth);

    expect(activas.body.data.map((p) => p.code)).toEqual(['ACT']);
    expect(inactivas.body.data.map((p) => p.code)).toEqual(['INA']);
    expect(ambas.body.meta.total).toBe(2);
  });

  test('test_pagina_los_resultados', async () => {
    for (let i = 1; i <= 5; i += 1) await createPart({ name: `Pieza ${i}` });

    const res = await listar(auth, '?page=2&pageSize=2');

    expect(res.body.data.map((p) => p.name)).toEqual(['Pieza 3', 'Pieza 4']);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
  });

  test('test_el_estado_de_existencia_se_calcula_por_refaccion', async () => {
    await createPart({ code: 'A1', stock: 10, minimumStock: 3 });
    await createPart({ code: 'A2', stock: 3, minimumStock: 3 });
    await createPart({ code: 'A3', stock: 0, minimumStock: 3 });

    const res = await listar(auth);

    expect(Object.fromEntries(res.body.data.map((p) => [p.code, p.stockStatus]))).toEqual({
      A1: 'OK',
      A2: 'LOW',
      A3: 'OUT'
    });
  });
});

describe('baja y reactivación', () => {
  test('test_la_baja_deja_inactiva_la_refaccion_sin_perder_movimientos_y_es_idempotente', async () => {
    const pieza = await createPart({ stock: 4 });

    const primera = await request(app).post(`/api/parts/${pieza.id}/deactivate`).set('Authorization', auth);
    const segunda = await request(app).post(`/api/parts/${pieza.id}/deactivate`).set('Authorization', auth);

    expect(primera.body.data.active).toBe(false);
    expect(segunda.status).toBe(200);
    expect(segunda.body.data.active).toBe(false);
    expect(await movimientosDe(pieza.id)).toHaveLength(1);
  });

  test('test_la_reactivacion_vuelve_a_activarla', async () => {
    const pieza = await createPart({ active: 0 });

    const res = await request(app).post(`/api/parts/${pieza.id}/activate`).set('Authorization', auth);

    expect(res.body.data.active).toBe(true);
  });

  test('test_no_existe_ruta_para_eliminar_refacciones', async () => {
    const pieza = await createPart();

    const res = await request(app).delete(`/api/parts/${pieza.id}`).set('Authorization', auth);

    expect([404, 405]).toContain(res.status);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM parts');
    expect(total).toBe(1);
  });
});

describe('permisos', () => {
  test.each(['RECEPTIONIST', 'MECHANIC'])('test_%s_recibe_403_en_todo_el_catalogo', async (rol) => {
    const { auth: otro } = await createAuthenticated(rol);
    const pieza = await createPart();
    const id = pieza.id;

    const respuestas = await Promise.all([
      request(app).get('/api/parts').set('Authorization', otro),
      request(app).post('/api/parts').set('Authorization', otro).send({ code: 'X', name: 'X', price: 1 }),
      request(app).get(`/api/parts/${id}`).set('Authorization', otro),
      request(app).patch(`/api/parts/${id}`).set('Authorization', otro).send({ name: 'Y' }),
      request(app).post(`/api/parts/${id}/deactivate`).set('Authorization', otro),
      request(app).post(`/api/parts/${id}/activate`).set('Authorization', otro)
    ]);

    for (const res of respuestas) expect(res.status).toBe(403);
  });

  test('test_sin_token_responde_401', async () => {
    const res = await request(app).get('/api/parts');

    expect(res.status).toBe(401);
  });
});
