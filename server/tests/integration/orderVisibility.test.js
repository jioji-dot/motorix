// Pruebas de integración de la visibilidad de órdenes por rol (US5) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMechanic,
  createOrder,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const listar = (auth, query = '') => request(app).get(`/api/orders${query}`).set('Authorization', auth);
const detalle = (auth, id) => request(app).get(`/api/orders/${id}`).set('Authorization', auth);
const ids = (res) => res.body.data.map((o) => o.id);

beforeEach(cleanTables);
afterAll(closePool);

describe('visibilidad para el mecánico', () => {
  test('test_el_mecanico_solo_recibe_sus_ordenes_y_nunca_las_de_otro', async () => {
    const yo = await createAuthenticated('MECHANIC');
    const otro = await createAuthenticated('MECHANIC');
    const mia = await createOrder({ mechanicId: yo.user.id });
    await createOrder({ mechanicId: otro.user.id });
    await createOrder({ mechanicId: null });

    const res = await listar(yo.auth);

    expect(ids(res)).toEqual([mia.id]);
    expect(res.body.meta.total).toBe(1);
  });

  test('test_ignora_el_filtro_de_otro_mecanico', async () => {
    const yo = await createAuthenticated('MECHANIC');
    const otro = await createAuthenticated('MECHANIC');
    const mia = await createOrder({ mechanicId: yo.user.id });
    await createOrder({ mechanicId: otro.user.id });

    const res = await listar(yo.auth, `?mechanicId=${otro.user.id}`);

    expect(ids(res)).toEqual([mia.id]);
  });

  test('test_pone_las_ordenes_abiertas_antes_que_las_terminadas_y_entregadas', async () => {
    const yo = await createAuthenticated('MECHANIC');
    const entregada = await createOrder({ mechanicId: yo.user.id, status: 'ENTREGADO' });
    const abierta = await createOrder({ mechanicId: yo.user.id, status: 'EN_REPARACION' });
    const terminada = await createOrder({ mechanicId: yo.user.id, status: 'TERMINADO' });
    const reciente = await createOrder({ mechanicId: yo.user.id, status: 'DIAGNOSTICO' });

    const res = await listar(yo.auth);

    expect(ids(res)).toEqual([reciente.id, abierta.id, terminada.id, entregada.id]);
  });

  test('test_filtra_sus_ordenes_por_estado', async () => {
    const yo = await createAuthenticated('MECHANIC');
    await createOrder({ mechanicId: yo.user.id, status: 'DIAGNOSTICO' });
    const enReparacion = await createOrder({ mechanicId: yo.user.id, status: 'EN_REPARACION' });

    const res = await listar(yo.auth, '?status=EN_REPARACION');

    expect(ids(res)).toEqual([enReparacion.id]);
  });

  test('test_el_detalle_de_una_orden_ajena_y_el_de_una_inexistente_responden_igual', async () => {
    const yo = await createAuthenticated('MECHANIC');
    const otro = await createAuthenticated('MECHANIC');
    const ajena = await createOrder({ mechanicId: otro.user.id });
    const sinMecanico = await createOrder({ mechanicId: null });

    const resAjena = await detalle(yo.auth, ajena.id);
    const resSinMecanico = await detalle(yo.auth, sinMecanico.id);
    const resInexistente = await detalle(yo.auth, 99999);

    expect(resAjena.status).toBe(404);
    expect(resAjena.body).toEqual(resInexistente.body);
    expect(resSinMecanico.status).toBe(404);
    expect(resSinMecanico.body).toEqual(resInexistente.body);
  });

  test('test_un_mecanico_sin_ordenes_recibe_una_lista_vacia', async () => {
    const yo = await createAuthenticated('MECHANIC');
    await createOrder();

    const res = await listar(yo.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('test_el_mecanico_ve_el_detalle_completo_de_su_orden', async () => {
    const yo = await createAuthenticated('MECHANIC');
    const mia = await createOrder({ mechanicId: yo.user.id, status: 'DIAGNOSTICO', diagnosis: 'Balatas gastadas' });

    const res = await detalle(yo.auth, mia.id);

    expect(res.status).toBe(200);
    expect(res.body.data.diagnosis).toBe('Balatas gastadas');
    expect(res.body.data.statusHistory.map((h) => h.toStatus)).toEqual(['RECIBIDO', 'DIAGNOSTICO']);
  });
});

describe('visibilidad para recepción y administración', () => {
  test.each(['RECEPTIONIST', 'ADMIN'])('test_el_rol_%s_ve_todas_las_ordenes', async (rol) => {
    const { auth } = await createAuthenticated(rol);
    const uno = await createMechanic();
    const a = await createOrder({ mechanicId: uno.id });
    const b = await createOrder({ mechanicId: null });

    const res = await listar(auth);

    expect(ids(res)).toEqual([b.id, a.id]);
    expect((await detalle(auth, a.id)).status).toBe(200);
    expect((await detalle(auth, b.id)).status).toBe(200);
  });

  test('test_las_mas_recientes_van_primero', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const vieja = await createOrder({ status: 'ENTREGADO' });
    const nueva = await createOrder({ status: 'RECIBIDO' });

    const res = await listar(auth);

    expect(ids(res)).toEqual([nueva.id, vieja.id]);
  });

  test('test_filtra_por_estado_mecanico_y_cliente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const uno = await createMechanic();
    const otro = await createMechanic();
    const clienteA = await createClient();
    const a = await createOrder({ clientId: clienteA.id, mechanicId: uno.id, status: 'DIAGNOSTICO' });
    const b = await createOrder({ mechanicId: otro.id, status: 'EN_REPARACION' });

    expect(ids(await listar(auth, '?status=EN_REPARACION'))).toEqual([b.id]);
    expect(ids(await listar(auth, `?mechanicId=${uno.id}`))).toEqual([a.id]);
    expect(ids(await listar(auth, `?clientId=${clienteA.id}`))).toEqual([a.id]);
  });

  test('test_busca_por_folio_cliente_o_placa', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const ana = await createClient({ name: 'Ana Pérez' });
    const luis = await createClient({ name: 'Luis Gómez' });
    const autoAna = await createVehicle(ana.id, { licensePlate: 'AAA111' });
    const autoLuis = await createVehicle(luis.id, { licensePlate: 'BBB222' });
    const deAna = await createOrder({ clientId: ana.id, vehicleId: autoAna.id });
    const deLuis = await createOrder({ clientId: luis.id, vehicleId: autoLuis.id });

    expect(ids(await listar(auth, '?search=ana'))).toEqual([deAna.id]);
    expect(ids(await listar(auth, '?search=bbb-222'))).toEqual([deLuis.id]);
    expect(ids(await listar(auth, `?search=${deLuis.folio}`))).toEqual([deLuis.id]);
    expect(ids(await listar(auth, '?search=zzz'))).toEqual([]);
  });

  test('test_pagina_el_listado', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    for (let i = 0; i < 25; i += 1) await createOrder();

    const res = await listar(auth, '?page=2&pageSize=10');

    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 10, total: 25 });
  });

  test('test_rechaza_filtros_con_valores_invalidos', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    expect((await listar(auth, '?status=OTRO')).status).toBe(400);
    expect((await listar(auth, '?mechanicId=abc')).status).toBe(400);
    expect((await detalle(auth, 'abc')).status).toBe(400);
  });

  test('test_exige_sesion', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
    expect((await request(app).get('/api/orders/1')).status).toBe(401);
  });
});

describe('acciones calculadas para quien consulta', () => {
  test('test_el_mecanico_asignado_en_reparacion_puede_trabajar_y_avanzar', async () => {
    const yo = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: yo.user.id, status: 'EN_REPARACION' });

    const res = await detalle(yo.auth, orden.id);

    expect(res.body.data.allowedTransitions.sort()).toEqual(['ESPERANDO_REFACCION', 'TERMINADO']);
    expect(res.body.data.editable).toEqual({ work: true, notesAndRecommendations: true, parts: true, basicData: false });
  });

  test('test_el_mecanico_asignado_en_una_orden_terminada_solo_edita_observaciones_y_recomendaciones', async () => {
    const yo = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: yo.user.id, status: 'TERMINADO' });

    const res = await detalle(yo.auth, orden.id);

    expect(res.body.data.allowedTransitions).toEqual([]);
    expect(res.body.data.editable).toEqual({ work: false, notesAndRecommendations: true, parts: false, basicData: false });
  });

  test('test_la_recepcion_corrige_datos_basicos_pero_no_trabaja_ni_avanza_hasta_terminado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const mecanico = await createMechanic();
    const orden = await createOrder({ mechanicId: mecanico.id, status: 'EN_REPARACION' });

    const res = await detalle(auth, orden.id);

    expect(res.body.data.allowedTransitions).toEqual([]);
    expect(res.body.data.editable).toEqual({ work: false, notesAndRecommendations: false, parts: false, basicData: true });
  });

  test('test_la_recepcion_puede_entregar_una_orden_terminada', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder({ status: 'TERMINADO' });

    const res = await detalle(auth, orden.id);

    expect(res.body.data.allowedTransitions).toEqual(['ENTREGADO']);
    expect(res.body.data.editable.basicData).toBe(false);
  });

  test('test_el_administrador_puede_todo_en_una_orden_abierta', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const mecanico = await createMechanic();
    const orden = await createOrder({ mechanicId: mecanico.id, status: 'RECIBIDO' });

    const res = await detalle(auth, orden.id);

    expect(res.body.data.allowedTransitions).toEqual(['DIAGNOSTICO']);
    expect(res.body.data.editable).toEqual({ work: true, notesAndRecommendations: true, parts: true, basicData: true });
  });

  test('test_una_orden_entregada_no_ofrece_ninguna_accion_a_nadie', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'ENTREGADO' });
    const vacio = { work: false, notesAndRecommendations: false, parts: false, basicData: false };

    for (const auth of [
      mecanico.auth,
      (await createAuthenticated('RECEPTIONIST')).auth,
      (await createAuthenticated('ADMIN')).auth
    ]) {
      const res = await detalle(auth, orden.id);
      expect(res.body.data.allowedTransitions).toEqual([]);
      expect(res.body.data.editable).toEqual(vacio);
    }
  });
});
