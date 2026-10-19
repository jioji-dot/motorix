// Contrato de PATCH /api/orders/:id y de /services y /labor (specs/002-citas-ordenes-servicio/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let ordenId;
const mecanico = () => ({ Authorization: `Bearer ${usuarios.MECHANIC.token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const datos = await crearClienteConVehiculo();
  ordenId = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
});

afterAll(cerrarConexiones);

describe('PATCH /api/orders/:id', () => {
  test('responde_200_con_la_orden_completa_actualizada', async () => {
    const respuesta = await request(app).patch(`/api/orders/${ordenId}`).set(mecanico()).send({ diagnosis: 'Diagnóstico de contrato' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      id: ordenId,
      diagnosis: 'Diagnóstico de contrato',
      services: [],
      labor: [],
      allowedTransitions: expect.any(Array),
      history: expect.any(Array),
    });
  });

  test('responde_403_con_error_estandar_si_el_campo_no_corresponde_al_rol', async () => {
    const respuesta = await request(app).patch(`/api/orders/${ordenId}`).set(mecanico()).send({ reportedProblem: 'x' });
    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  test('responde_400_si_no_se_envia_ningun_campo', async () => {
    const respuesta = await request(app).patch(`/api/orders/${ordenId}`).set(mecanico()).send({});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Servicios', () => {
  test('POST responde_201_con_la_orden_completa_y_el_total_recalculado', async () => {
    const respuesta = await request(app)
      .post(`/api/orders/${ordenId}/services`)
      .set(mecanico())
      .send({ description: 'Cambio de aceite', amount: 450 });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.services).toEqual([{ id: expect.any(Number), description: 'Cambio de aceite', amount: '450.00' }]);
    expect(respuesta.body.data.total).toBe('450.00');
  });

  test('PATCH y DELETE responden_200_con_la_orden_completa', async () => {
    const lista = await request(app).get(`/api/orders/${ordenId}`).set(mecanico());
    const lineaId = lista.body.data.services[0].id;

    const editada = await request(app).patch(`/api/orders/${ordenId}/services/${lineaId}`).set(mecanico()).send({ amount: 500, description: 'Aceite sintético' });
    expect(editada.status).toBe(200);
    expect(editada.body.data.services[0]).toEqual({ id: lineaId, description: 'Aceite sintético', amount: '500.00' });
    expect(editada.body.data.total).toBe('500.00');

    const quitada = await request(app).delete(`/api/orders/${ordenId}/services/${lineaId}`).set(mecanico());
    expect(quitada.status).toBe(200);
    expect(quitada.body.data.services).toEqual([]);
    expect(quitada.body.data.total).toBe('0.00');
  });

  test('responde_400_con_detalles_por_campo_y_404_si_la_linea_no_existe', async () => {
    const invalida = await request(app).post(`/api/orders/${ordenId}/services`).set(mecanico()).send({});
    expect(invalida.status).toBe(400);
    expect(invalida.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['description', 'amount']));
    const noExiste = await request(app).patch(`/api/orders/${ordenId}/services/987654`).set(mecanico()).send({ amount: 1 });
    expect(noExiste.status).toBe(404);
    expect(noExiste.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });
});

describe('Mano de obra', () => {
  test('POST responde_201_con_el_importe_calculado_y_PATCH_y_DELETE_responden_200', async () => {
    const alta = await request(app)
      .post(`/api/orders/${ordenId}/labor`)
      .set(mecanico())
      .send({ description: 'Desmontaje', hours: 2.5, hourlyRate: 300 });
    expect(alta.status).toBe(201);
    expect(alta.body.data.labor).toEqual([
      { id: expect.any(Number), description: 'Desmontaje', hours: '2.50', hourlyRate: '300.00', amount: '750.00' },
    ]);
    expect(alta.body.data.total).toBe('750.00');

    const laborId = alta.body.data.labor[0].id;
    const editada = await request(app).patch(`/api/orders/${ordenId}/labor/${laborId}`).set(mecanico()).send({ hourlyRate: 400 });
    expect(editada.body.data.labor[0].amount).toBe('1000.00');

    const quitada = await request(app).delete(`/api/orders/${ordenId}/labor/${laborId}`).set(mecanico());
    expect(quitada.body.data.labor).toEqual([]);
    expect(quitada.body.data.total).toBe('0.00');
  });

  test('responde_409_ORDER_NOT_EDITABLE_cuando_la_orden_ya_no_esta_en_curso', async () => {
    const datos = await crearClienteConVehiculo();
    const entregada = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'ENTREGADO' });
    const respuesta = await request(app)
      .post(`/api/orders/${entregada}/labor`)
      .set(mecanico())
      .send({ description: 'x', hours: 1, hourlyRate: 1 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: { code: 'ORDER_NOT_EDITABLE', message: expect.any(String) } });
  });
});
