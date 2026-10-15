// Pruebas de integración de la asignación y corrección de datos básicos de la orden (US4).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMechanic,
  createOrder,
  createUser,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const editar = (auth, id, cuerpo) => request(app).patch(`/api/orders/${id}`).set('Authorization', auth).send(cuerpo);
const crear = (auth, cuerpo) => request(app).post('/api/orders').set('Authorization', auth).send(cuerpo);
const detalle = (auth, id) => request(app).get(`/api/orders/${id}`).set('Authorization', auth);

beforeEach(cleanTables);
afterAll(closePool);

describe('asignación de mecánico', () => {
  test('test_asigna_un_mecanico_al_crear_la_orden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const auto = await createVehicle(cliente.id);
    const mecanico = await createMechanic({ name: 'Mario Mecánico' });

    const res = await crear(auth, {
      clientId: cliente.id,
      vehicleId: auto.id,
      entryMileage: 1000,
      reportedProblem: 'Ruido',
      mechanicId: mecanico.id
    });

    expect(res.status).toBe(201);
    expect(res.body.data.mechanicName).toBe('Mario Mecánico');
  });

  test('test_asigna_y_reasigna_un_mecanico_mientras_la_orden_no_este_terminada', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const uno = await createMechanic();
    const dos = await createMechanic();
    const orden = await createOrder();

    const primera = await editar(auth, orden.id, { mechanicId: uno.id });
    const segunda = await editar(auth, orden.id, { mechanicId: dos.id });

    expect(primera.status).toBe(200);
    expect(primera.body.data.mechanicId).toBe(uno.id);
    expect(segunda.body.data.mechanicId).toBe(dos.id);
  });

  test('test_la_orden_deja_de_aparecer_al_mecanico_anterior_y_aparece_al_nuevo', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const uno = await createAuthenticated('MECHANIC');
    const dos = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: uno.user.id, status: 'DIAGNOSTICO' });

    await editar(auth, orden.id, { mechanicId: dos.user.id });

    expect((await detalle(uno.auth, orden.id)).status).toBe(404);
    expect((await detalle(dos.auth, orden.id)).status).toBe(200);
  });

  test.each(['TERMINADO', 'ENTREGADO'])('test_no_se_reasigna_una_orden_%s', async (estado) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const mecanico = await createMechanic();
    const otro = await createMechanic();
    const orden = await createOrder({ mechanicId: mecanico.id, status: estado });

    const res = await editar(auth, orden.id, { mechanicId: otro.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
    expect(res.body.error.details).toEqual({ status: estado });
  });

  test.each([
    ['una recepcionista', () => createUser({ role: 'RECEPTIONIST' })],
    ['un administrador', () => createUser({ role: 'ADMIN' })],
    ['un mecánico inactivo', () => createMechanic({ active: false })]
  ])('test_rechaza_asignar_a_%s', async (_nombre, fabricar) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const invalido = await fabricar();
    const orden = await createOrder();

    const res = await editar(auth, orden.id, { mechanicId: invalido.id });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('mechanicId');
    expect((await detalle(auth, orden.id)).body.data.mechanicId).toBeNull();
  });

  test('test_rechaza_asignar_a_un_usuario_inexistente_al_crear_o_editar', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder();

    const edicion = await editar(auth, orden.id, { mechanicId: 99999 });
    const alta = await crear(auth, {
      clientId: orden.clientId,
      vehicleId: orden.vehicleId,
      entryMileage: 5000,
      reportedProblem: 'Otro',
      mechanicId: 99999
    });

    expect(edicion.status).toBe(400);
    expect(alta.status).toBe(400);
  });

  test('test_solo_se_puede_quitar_el_mecanico_en_una_orden_recibida', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const mecanico = await createMechanic();
    const recibida = await createOrder({ mechanicId: mecanico.id, status: 'RECIBIDO' });
    const enProceso = await createOrder({ mechanicId: mecanico.id, status: 'DIAGNOSTICO' });

    const quitada = await editar(auth, recibida.id, { mechanicId: null });
    const rechazada = await editar(auth, enProceso.id, { mechanicId: null });

    expect(quitada.status).toBe(200);
    expect(quitada.body.data.mechanicId).toBeNull();
    expect(rechazada.status).toBe(400);
    expect(rechazada.body.error.details.map((d) => d.field)).toContain('mechanicId');
  });
});

describe('corrección de datos básicos', () => {
  test('test_corrige_el_problema_reportado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder({ reportedProblem: 'Ruido' });

    const res = await editar(auth, orden.id, { reportedProblem: '  Ruido al frenar y vibración  ' });

    expect(res.status).toBe(200);
    expect(res.body.data.reportedProblem).toBe('Ruido al frenar y vibración');
  });

  test.each([
    ['vacío', '   '],
    ['demasiado largo', 'a'.repeat(1001)]
  ])('test_rechaza_un_problema_reportado_%s', async (_nombre, valor) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder({ reportedProblem: 'Ruido' });

    const res = await editar(auth, orden.id, { reportedProblem: valor });

    expect(res.status).toBe(400);
    expect((await detalle(auth, orden.id)).body.data.reportedProblem).toBe('Ruido');
  });

  test('test_el_kilometraje_solo_cambia_con_correccion_explicita_si_baja', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const auto = await createVehicle(cliente.id, { currentMileage: 50000 });
    const orden = await createOrder({ clientId: cliente.id, vehicleId: auto.id, entryMileage: 50000 });

    const sinCorreccion = await editar(auth, orden.id, { entryMileage: 45000 });
    const conCorreccion = await editar(auth, orden.id, { entryMileage: 45000, mileageCorrection: true });

    expect(sinCorreccion.status).toBe(409);
    expect(sinCorreccion.body.error.code).toBe('MILEAGE_DECREASE');
    expect(conCorreccion.status).toBe(200);
    expect(conCorreccion.body.data.entryMileage).toBe(45000);
    const [[fila]] = await pool.query('SELECT current_mileage FROM vehicles WHERE id = ?', [auto.id]);
    expect(fila.current_mileage).toBe(45000);
  });

  test('test_un_kilometraje_mayor_se_acepta_y_actualiza_el_vehiculo', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const cliente = await createClient();
    const auto = await createVehicle(cliente.id, { currentMileage: 50000 });
    const orden = await createOrder({ clientId: cliente.id, vehicleId: auto.id, entryMileage: 50000 });

    const res = await editar(auth, orden.id, { entryMileage: 50500 });

    expect(res.status).toBe(200);
    const [[fila]] = await pool.query('SELECT current_mileage FROM vehicles WHERE id = ?', [auto.id]);
    expect(fila.current_mileage).toBe(50500);
  });

  test.each([
    ['negativo', -1],
    ['decimal', 10.5],
    ['texto', '1000']
  ])('test_rechaza_un_kilometraje_%s', async (_nombre, valor) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder();

    const res = await editar(auth, orden.id, { entryMileage: valor });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('entryMileage');
  });

  test('test_una_edicion_vacia_responde_400', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder();

    expect((await editar(auth, orden.id, {})).status).toBe(400);
  });

  test('test_no_acepta_cambiar_el_cliente_ni_el_vehiculo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder();
    const otro = await createClient();

    await editar(auth, orden.id, { clientId: otro.id, reportedProblem: 'Nuevo texto' });

    const actual = (await detalle(auth, orden.id)).body.data;
    expect(actual.clientId).toBe(orden.clientId);
    expect(actual.reportedProblem).toBe('Nuevo texto');
  });

  test('test_no_se_corrigen_datos_de_ordenes_terminadas_ni_entregadas', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    for (const estado of ['TERMINADO', 'ENTREGADO']) {
      const orden = await createOrder({ status: estado });
      const res = await editar(auth, orden.id, { reportedProblem: 'Cambio' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
    }
  });
});

describe('permisos de la corrección', () => {
  test('test_el_mecanico_recibe_403_aunque_la_orden_sea_suya', async () => {
    const { auth, user } = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: user.id });

    const res = await editar(auth, orden.id, { reportedProblem: 'Cambio' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('test_una_orden_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    expect((await editar(auth, 99999, { reportedProblem: 'Cambio' })).status).toBe(404);
  });

  test('test_exige_sesion', async () => {
    expect((await request(app).patch('/api/orders/1').send({ reportedProblem: 'x' })).status).toBe(401);
  });
});
