// Pruebas de integración de las alertas de stock bajo (US8) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createPart } from '../helpers/factories.js';

const app = createApp();

const resumen = (auth) => request(app).get('/api/parts/alerts').set('Authorization', auth);
const listar = (auth, consulta = '') => request(app).get(`/api/parts${consulta}`).set('Authorization', auth);

let admin;

beforeEach(async () => {
  await cleanTables();
  admin = await createAuthenticated('ADMIN');
});
afterAll(closePool);

describe('resumen de alertas', () => {
  test('test_low_cuenta_las_que_tienen_existencia_mayor_a_cero_e_igual_o_menor_al_minimo', async () => {
    await createPart({ stock: 1, minimumStock: 5 });
    await createPart({ stock: 5, minimumStock: 5 });
    await createPart({ stock: 6, minimumStock: 5 });

    const res = await resumen(admin.auth);

    expect(res.body.data).toEqual({ low: 2, out: 0, total: 2 });
  });

  test('test_out_cuenta_las_agotadas_incluso_con_minimo_cero', async () => {
    await createPart({ stock: 0, minimumStock: 0 });
    await createPart({ stock: 0, minimumStock: 4 });

    const res = await resumen(admin.auth);

    expect(res.body.data).toEqual({ low: 0, out: 2, total: 2 });
  });

  test('test_las_refacciones_inactivas_no_cuentan', async () => {
    await createPart({ stock: 0, minimumStock: 5, active: 0 });
    await createPart({ stock: 1, minimumStock: 5, active: 0 });

    const res = await resumen(admin.auth);

    expect(res.body.data).toEqual({ low: 0, out: 0, total: 0 });
  });

  test('test_sin_refacciones_devuelve_ceros', async () => {
    const res = await resumen(admin.auth);

    expect(res.body.data).toEqual({ low: 0, out: 0, total: 0 });
  });

  test('test_el_resumen_coincide_con_el_total_del_listado_filtrado', async () => {
    await createPart({ stock: 1, minimumStock: 5 });
    await createPart({ stock: 0, minimumStock: 5 });
    await createPart({ stock: 0, minimumStock: 5, active: 0 });
    await createPart({ stock: 30, minimumStock: 5 });

    const conteo = (await resumen(admin.auth)).body.data;
    const bajas = await listar(admin.auth, '?alert=LOW');
    const agotadas = await listar(admin.auth, '?alert=OUT');
    const ambas = await listar(admin.auth, '?alert=ANY');

    expect(bajas.body.meta.total).toBe(conteo.low);
    expect(agotadas.body.meta.total).toBe(conteo.out);
    expect(ambas.body.meta.total).toBe(conteo.total);
  });
});

describe('alertas por uso y reabastecimiento', () => {
  test('test_una_salida_por_orden_que_lleva_la_existencia_al_minimo_activa_la_alerta_de_inmediato', async () => {
    const pieza = await createPart({ stock: 8, minimumStock: 5 });
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });
    expect((await resumen(admin.auth)).body.data.total).toBe(0);

    const uso = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 3 });

    expect(uso.status).toBe(200);
    expect((await resumen(admin.auth)).body.data).toEqual({ low: 1, out: 0, total: 1 });
  });

  test('test_usar_toda_la_existencia_pasa_de_bajo_a_agotada', async () => {
    const pieza = await createPart({ stock: 2, minimumStock: 5 });
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });

    await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 2 });

    expect((await resumen(admin.auth)).body.data).toEqual({ low: 0, out: 1, total: 1 });
  });

  test('test_una_entrada_que_supera_el_minimo_quita_la_alerta', async () => {
    const pieza = await createPart({ stock: 1, minimumStock: 5 });
    expect((await resumen(admin.auth)).body.data.total).toBe(1);

    await request(app)
      .post(`/api/parts/${pieza.id}/entries`)
      .set('Authorization', admin.auth)
      .send({ quantity: 10, reason: 'Compra' });

    expect((await resumen(admin.auth)).body.data.total).toBe(0);
    expect((await listar(admin.auth, '?alert=ANY')).body.data).toEqual([]);
  });

  test('test_una_entrada_que_no_supera_el_minimo_mantiene_la_alerta', async () => {
    const pieza = await createPart({ stock: 0, minimumStock: 5 });

    await request(app)
      .post(`/api/parts/${pieza.id}/entries`)
      .set('Authorization', admin.auth)
      .send({ quantity: 3, reason: 'Compra parcial' });

    expect((await resumen(admin.auth)).body.data).toEqual({ low: 1, out: 0, total: 1 });
  });

  test('test_dar_de_baja_una_refaccion_en_alerta_la_quita_del_resumen', async () => {
    const pieza = await createPart({ stock: 0, minimumStock: 5 });

    await request(app).post(`/api/parts/${pieza.id}/deactivate`).set('Authorization', admin.auth);

    expect((await resumen(admin.auth)).body.data.total).toBe(0);
  });

  test('test_subir_el_minimo_de_una_refaccion_la_pone_en_alerta', async () => {
    const pieza = await createPart({ stock: 10, minimumStock: 2 });

    await request(app).patch(`/api/parts/${pieza.id}`).set('Authorization', admin.auth).send({ minimumStock: 10 });

    expect((await resumen(admin.auth)).body.data).toEqual({ low: 1, out: 0, total: 1 });
  });
});

describe('filtro alert del listado', () => {
  test('test_low_out_y_any_devuelven_las_coincidencias_correctas', async () => {
    await createPart({ code: 'BAJA', stock: 2, minimumStock: 5 });
    await createPart({ code: 'AGOTADA', stock: 0, minimumStock: 5 });
    await createPart({ code: 'NORMAL', stock: 50, minimumStock: 5 });

    const low = await listar(admin.auth, '?alert=LOW');
    const out = await listar(admin.auth, '?alert=OUT');
    const any = await listar(admin.auth, '?alert=ANY');

    expect(low.body.data.map((p) => p.code)).toEqual(['BAJA']);
    expect(out.body.data.map((p) => p.code)).toEqual(['AGOTADA']);
    expect(any.body.data.map((p) => p.code).sort()).toEqual(['AGOTADA', 'BAJA']);
  });

  test('test_el_filtro_de_alerta_solo_considera_refacciones_activas', async () => {
    await createPart({ code: 'INACTIVA', stock: 0, minimumStock: 5, active: 0 });

    const res = await listar(admin.auth, '?alert=ANY');

    expect(res.body.data).toEqual([]);
  });

  test('test_se_combina_con_la_busqueda_y_la_paginacion', async () => {
    await createPart({ code: 'FIL-1', name: 'Filtro uno', stock: 1, minimumStock: 5 });
    await createPart({ code: 'FIL-2', name: 'Filtro dos', stock: 0, minimumStock: 5 });
    await createPart({ code: 'BAL-1', name: 'Balata', stock: 0, minimumStock: 5 });

    const res = await listar(admin.auth, '?alert=ANY&search=filtro&page=1&pageSize=1');

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 1, total: 2 });
  });
});

describe('permisos de las alertas', () => {
  test.each(['RECEPTIONIST', 'MECHANIC'])('test_%s_recibe_403_en_el_resumen_y_en_el_filtro', async (rol) => {
    const { auth } = await createAuthenticated(rol);

    expect((await resumen(auth)).status).toBe(403);
    expect((await listar(auth, '?alert=ANY')).status).toBe(403);
  });

  test('test_sin_token_responde_401', async () => {
    expect((await request(app).get('/api/parts/alerts')).status).toBe(401);
  });
});
