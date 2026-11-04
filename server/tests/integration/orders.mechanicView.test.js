// Vista del mecánico (Sprint 5, FR-007 y FR-008): sigue usando las refacciones y los servicios, pero sin ver precios.
import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearRefaccion,
  crearSegundoMecanico,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let mecanico2;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
const soloMecanico = (metodo, ruta, cuerpo) => request(app)[metodo](ruta).set(como('MECHANIC')).send(cuerpo);

// El detalle de una orden para el mecánico no trae total ni precio ni importe de refacciones.
function sinDinero(cuerpo) {
  expect(cuerpo.data).not.toHaveProperty('total');
  for (const linea of cuerpo.data.parts) {
    expect(linea).not.toHaveProperty('unitPrice');
    expect(linea).not.toHaveProperty('amount');
  }
}

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  mecanico2 = await crearSegundoMecanico();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Vista del mecánico sin precios (integración, Sprint 5)', () => {
  test('el_mecanico_agrega_cambia_la_cantidad_y_quita_refacciones_y_cada_respuesta_no_trae_dinero', async () => {
    const orden = await nuevaOrden();
    const { id: partId, code } = await crearRefaccion({ stock: 10, salePrice: 150 });

    const alta = await soloMecanico('post', `/api/orders/${orden}/parts`, { partId, quantity: 2 });
    expect(alta.status).toBe(201);
    sinDinero(alta.body);
    expect(alta.body.data.parts[0]).toMatchObject({ partId, code, quantity: 2, name: expect.any(String) });

    const lineId = alta.body.data.parts[0].id;
    const cambio = await soloMecanico('patch', `/api/orders/${orden}/parts/${lineId}`, { quantity: 3 });
    expect(cambio.status).toBe(200);
    sinDinero(cambio.body);
    expect(cambio.body.data.parts[0].quantity).toBe(3);

    const baja = await soloMecanico('delete', `/api/orders/${orden}/parts/${lineId}`);
    expect(baja.status).toBe(200);
    sinDinero(baja.body);
    expect(baja.body.data.parts).toEqual([]);

    // El total real sigue calculándose: lo ve recepción, no el mecánico.
    const recepcion = await request(app).get(`/api/orders/${orden}`).set(como('RECEPTIONIST'));
    expect(recepcion.body.data.total).toBe('0.00');
  });

  test('las_rutas_de_escritura_de_servicios_y_mano_de_obra_tampoco_devuelven_el_total_pero_si_sus_importes', async () => {
    const orden = await nuevaOrden();
    const { id: partId } = await crearRefaccion({ stock: 10, salePrice: 40 });
    await soloMecanico('post', `/api/orders/${orden}/parts`, { partId, quantity: 1 });

    const servicio = await soloMecanico('post', `/api/orders/${orden}/services`, { description: 'Afinación', amount: 250 });
    expect(servicio.status).toBe(201);
    sinDinero(servicio.body);
    expect(servicio.body.data.services[0]).toMatchObject({ description: 'Afinación', amount: '250.00' });

    const manoDeObra = await soloMecanico('post', `/api/orders/${orden}/labor`, { description: 'Mano de obra', hours: 2, hourlyRate: 100 });
    expect(manoDeObra.status).toBe(201);
    sinDinero(manoDeObra.body);
    expect(manoDeObra.body.data.labor[0]).toMatchObject({ hours: '2.00', hourlyRate: '100.00', amount: '200.00' });

    const editado = await soloMecanico('patch', `/api/orders/${orden}`, { diagnosis: 'Bujías gastadas' });
    expect(editado.status).toBe(200);
    sinDinero(editado.body);

    const estado = await soloMecanico('post', `/api/orders/${orden}/status`, { status: 'TERMINADO' });
    expect(estado.status).toBe(200);
    sinDinero(estado.body);
  });

  test('el_mecanico_consulta_el_inventario_con_codigo_nombre_categoria_marca_y_existencia_sin_precios', async () => {
    const { id } = await crearRefaccion({ stock: 7, minimumStock: 3, salePrice: 99 });
    const lista = await request(app).get('/api/parts?pageSize=100').set(como('MECHANIC'));
    expect(lista.status).toBe(200);
    const parte = lista.body.data.find((p) => p.id === id);
    expect(parte).toMatchObject({ code: expect.any(String), name: expect.any(String), category: expect.any(String), brand: expect.any(String), stock: 7, minimumStock: 3 });
    expect(parte).not.toHaveProperty('salePrice');
    expect(parte).not.toHaveProperty('purchasePrice');
    const detalle = await request(app).get(`/api/parts/${id}`).set(como('MECHANIC'));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data).not.toHaveProperty('salePrice');
    expect(detalle.body.data.movements.length).toBeGreaterThan(0);
  });

  test('un_mecanico_no_asignado_recibe_403_y_los_pagos_y_el_ticket_tambien', async () => {
    const orden = await nuevaOrden();
    const otro = { Authorization: `Bearer ${mecanico2.token}` };
    expect((await request(app).get(`/api/orders/${orden}`).set(otro)).status).toBe(403);
    expect((await request(app).post(`/api/orders/${orden}/parts`).set(otro).send({ partId: 1, quantity: 1 })).status).toBe(403);
    expect((await request(app).get(`/api/orders/${orden}/payments`).set(como('MECHANIC'))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${orden}/ticket`).set(como('MECHANIC'))).status).toBe(403);
  });
});
