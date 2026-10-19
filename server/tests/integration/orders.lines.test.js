import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearSegundoMecanico,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let mecanico2;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const comoMecanico2 = () => ({ Authorization: `Bearer ${mecanico2.token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  mecanico2 = await crearSegundoMecanico();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

const nuevaOrden = (status = 'DIAGNOSTICO') =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status });

describe('Documentar el trabajo (integración)', () => {
  test('el_mecanico_asignado_registra_diagnostico_observaciones_y_recomendaciones', async () => {
    const id = await nuevaOrden();
    const respuesta = await request(app)
      .patch(`/api/orders/${id}`)
      .set(como('MECHANIC'))
      .send({ diagnosis: 'Falla en la bomba de agua', notes: 'Corrosión en mangueras', recommendations: 'Cambiar mangueras' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      diagnosis: 'Falla en la bomba de agua',
      notes: 'Corrosión en mangueras',
      recommendations: 'Cambiar mangueras',
    });
    // Recepción ve lo documentado.
    const vista = await request(app).get(`/api/orders/${id}`).set(como('RECEPTIONIST'));
    expect(vista.body.data.diagnosis).toBe('Falla en la bomba de agua');
  });

  test('el_total_siempre_coincide_con_la_suma_de_servicios_y_mano_de_obra', async () => {
    const id = await nuevaOrden();
    const mecanico = como('MECHANIC');

    const s1 = await request(app).post(`/api/orders/${id}/services`).set(mecanico).send({ description: 'Cambio de aceite', amount: 450 });
    expect(s1.status).toBe(201);
    expect(s1.body.data.total).toBe('450.00');

    const s2 = await request(app).post(`/api/orders/${id}/services`).set(mecanico).send({ description: 'Filtro de aire', amount: '120.50' });
    expect(s2.body.data.total).toBe('570.50');

    const l1 = await request(app)
      .post(`/api/orders/${id}/labor`)
      .set(mecanico)
      .send({ description: 'Mano de obra', hours: 1.25, hourlyRate: 333.33 });
    expect(l1.status).toBe(201);
    // 1.25 × 333.33 = 416.6625 → 416.66
    expect(l1.body.data.labor[0]).toMatchObject({ hours: '1.25', hourlyRate: '333.33', amount: '416.66' });
    expect(l1.body.data.total).toBe('987.16');

    const servicioId = s1.body.data.services[0].id;
    const laborId = l1.body.data.labor[0].id;

    const editado = await request(app).patch(`/api/orders/${id}/services/${servicioId}`).set(mecanico).send({ amount: 500 });
    expect(editado.body.data.total).toBe('1037.16');

    const laborEditada = await request(app).patch(`/api/orders/${id}/labor/${laborId}`).set(mecanico).send({ hours: 2 });
    expect(laborEditada.body.data.labor[0].amount).toBe('666.66');
    expect(laborEditada.body.data.total).toBe('1287.16');

    const sinServicio = await request(app).delete(`/api/orders/${id}/services/${servicioId}`).set(mecanico);
    expect(sinServicio.body.data.total).toBe('787.16');
    const sinLabor = await request(app).delete(`/api/orders/${id}/labor/${laborId}`).set(mecanico);
    expect(sinLabor.body.data.total).toBe('120.50');

    // El total guardado coincide con la suma real de las líneas.
    const [[suma]] = await pool.query(
      `SELECT (SELECT COALESCE(SUM(amount),0) FROM order_services WHERE orderId = ${id})
            + (SELECT COALESCE(SUM(amount),0) FROM order_labor WHERE orderId = ${id}) AS total`,
    );
    expect(Number(suma.total)).toBe(120.5);
    const [[orden]] = await pool.query('SELECT total FROM service_orders WHERE id = ?', [id]);
    expect(Number(orden.total)).toBe(120.5);
  });

  test('administrador_puede_documentar_cualquier_orden', async () => {
    const id = await nuevaOrden();
    const respuesta = await request(app).post(`/api/orders/${id}/services`).set(como('ADMIN')).send({ description: 'Revisión', amount: 100 });
    expect(respuesta.status).toBe(201);
  });

  test('otro_mecanico_y_recepcion_no_pueden_documentar', async () => {
    const id = await nuevaOrden();
    const linea = { description: 'Intento', amount: 10 };

    expect((await request(app).post(`/api/orders/${id}/services`).set(comoMecanico2()).send(linea)).status).toBe(403);
    expect((await request(app).post(`/api/orders/${id}/labor`).set(como('RECEPTIONIST')).send({ description: 'x', hours: 1, hourlyRate: 1 })).status).toBe(403);
    expect((await request(app).patch(`/api/orders/${id}`).set(comoMecanico2()).send({ diagnosis: 'x' })).status).toBe(403);
    expect((await request(app).patch(`/api/orders/${id}`).set(como('RECEPTIONIST')).send({ diagnosis: 'x' })).status).toBe(403);

    const [[cuenta]] = await pool.query(`SELECT COUNT(*) AS n FROM order_services WHERE orderId = ${id}`);
    expect(cuenta.n).toBe(0);
  });

  test('recepcion_corrige_el_problema_reportado_y_reasigna_al_mecanico', async () => {
    const id = await nuevaOrden('RECIBIDO');
    const respuesta = await request(app)
      .patch(`/api/orders/${id}`)
      .set(como('RECEPTIONIST'))
      .send({ reportedProblem: 'Ruido al frenar', mechanicId: mecanico2.id });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.reportedProblem).toBe('Ruido al frenar');
    expect(respuesta.body.data.mechanicId).toBe(mecanico2.id);

    // El mecánico anterior ya no la ve; el nuevo sí.
    expect((await request(app).get(`/api/orders/${id}`).set(como('MECHANIC'))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${id}`).set(comoMecanico2())).status).toBe(200);
    // Y el mecánico no puede reasignar ni cambiar el problema.
    expect((await request(app).patch(`/api/orders/${id}`).set(comoMecanico2()).send({ mechanicId: usuarios.MECHANIC.id })).status).toBe(403);
  });

  test.each(['TERMINADO', 'ENTREGADO', 'CANCELADA'])('las_ordenes_en_estado_%s_son_de_solo_lectura', async (status) => {
    const id = await nuevaOrden(status);
    const mecanico = como('MECHANIC');
    const bloqueado = async (peticion) => {
      const respuesta = await peticion;
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('ORDER_NOT_EDITABLE');
    };
    await bloqueado(request(app).patch(`/api/orders/${id}`).set(mecanico).send({ diagnosis: 'x' }));
    await bloqueado(request(app).post(`/api/orders/${id}/services`).set(mecanico).send({ description: 'x', amount: 1 }));
    await bloqueado(request(app).post(`/api/orders/${id}/labor`).set(mecanico).send({ description: 'x', hours: 1, hourlyRate: 1 }));
    await bloqueado(request(app).patch(`/api/orders/${id}`).set(como('RECEPTIONIST')).send({ reportedProblem: 'x' }));
  });

  test('valida_importes_horas_y_descripciones_con_mensajes_en_espanol', async () => {
    const id = await nuevaOrden();
    const mecanico = como('MECHANIC');

    const negativo = await request(app).post(`/api/orders/${id}/services`).set(mecanico).send({ description: 'Algo', amount: -5 });
    expect(negativo.status).toBe(400);
    expect(negativo.body.error.details[0]).toMatchObject({ field: 'amount' });

    const sinDescripcion = await request(app).post(`/api/orders/${id}/services`).set(mecanico).send({ description: '  ', amount: 5 });
    expect(sinDescripcion.status).toBe(400);
    expect(sinDescripcion.body.error.details[0].field).toBe('description');

    const horasCero = await request(app).post(`/api/orders/${id}/labor`).set(mecanico).send({ description: 'x', hours: 0, hourlyRate: 100 });
    expect(horasCero.status).toBe(400);
    expect(horasCero.body.error.details[0].field).toBe('hours');

    const masDecimales = await request(app).post(`/api/orders/${id}/services`).set(mecanico).send({ description: 'x', amount: 10.123 });
    expect(masDecimales.status).toBe(400);
  });

  test('una_linea_ajena_a_la_orden_o_inexistente_responde_404', async () => {
    const a = await nuevaOrden();
    const b = await nuevaOrden();
    const linea = await request(app).post(`/api/orders/${a}/services`).set(como('MECHANIC')).send({ description: 'De A', amount: 10 });
    const lineaId = linea.body.data.services[0].id;

    expect((await request(app).patch(`/api/orders/${b}/services/${lineaId}`).set(como('MECHANIC')).send({ amount: 99 })).status).toBe(404);
    expect((await request(app).delete(`/api/orders/${b}/services/${lineaId}`).set(como('MECHANIC'))).status).toBe(404);
    expect((await request(app).delete(`/api/orders/${a}/labor/99999`).set(como('MECHANIC'))).status).toBe(404);
    expect((await request(app).post('/api/orders/999999/services').set(como('ADMIN')).send({ description: 'x', amount: 1 })).status).toBe(404);
  });

  test('rechaza_peticiones_sin_token_y_ediciones_vacias', async () => {
    const id = await nuevaOrden();
    expect((await request(app).patch(`/api/orders/${id}`).send({ diagnosis: 'x' })).status).toBe(401);
    expect((await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({})).status).toBe(400);
  });
});
