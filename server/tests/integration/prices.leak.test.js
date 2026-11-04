// Recorrido de todas las rutas de lectura con cada rol buscando el precio de compra y el de venta (Sprint 5, FR-005 a FR-009).
// Con datos de valores distintivos, la prueba busca tanto la clave como el valor en cada respuesta.
import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearLineaDeRefaccion,
  crearOrdenCobrable,
  crearPago,
  crearRefaccion,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

const COMPRA = '73.41';
const VENTA = '188.88';
const IMPORTE_LINEA = '566.64'; // 3 piezas a 188.88
const TOTAL_ORDEN = '677.75'; // servicio de 111.11 + las tres piezas

let usuarios;
let datos;
let parteId;
let ordenId;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

// Rutas de lectura que devuelven refacciones, precios, importes o totales.
const rutas = () => [
  '/api/parts?pageSize=100',
  `/api/parts/${parteId}`,
  `/api/parts/${parteId}/movements`,
  '/api/parts/summary',
  '/api/parts/categories',
  '/api/orders',
  `/api/orders/${ordenId}`,
  `/api/vehicles/${datos.vehicleId}/history`,
  `/api/orders/${ordenId}/payments`,
  `/api/orders/${ordenId}/ticket`,
  '/api/dashboard',
];

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
  parteId = (await crearRefaccion({ stock: 20, purchasePrice: COMPRA, salePrice: VENTA })).id;
  ordenId = await crearOrdenCobrable({
    ...datos,
    mechanicId: usuarios.MECHANIC.id,
    createdBy: usuarios.RECEPTIONIST.id,
    total: '111.11',
    status: 'TERMINADO',
  });
  await crearLineaDeRefaccion({ orderId: ordenId, partId: parteId, quantity: 3 });
  await crearPago({ orderId: ordenId, createdBy: usuarios.RECEPTIONIST.id, amount: 100 });
  const ticket = await request(app).post(`/api/orders/${ordenId}/ticket`).set(como('ADMIN'));
  expect([200, 201]).toContain(ticket.status);
});

afterAll(cerrarConexiones);

async function recorrer(rol) {
  const respuestas = [];
  for (const ruta of rutas()) {
    const respuesta = await request(app).get(ruta).set(como(rol));
    respuestas.push({ ruta, status: respuesta.status, texto: JSON.stringify(respuesta.body) });
  }
  return respuestas;
}

describe('Fuga de precios por rol (integración, Sprint 5)', () => {
  test('recepcion_y_mecanico_no_reciben_el_precio_de_compra_en_ninguna_ruta', async () => {
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      const fugas = (await recorrer(rol))
        .filter(({ texto }) => texto.includes('purchasePrice') || texto.includes(COMPRA))
        .map(({ ruta }) => `${rol} ${ruta}`);
      expect(fugas).toEqual([]);
    }
  });

  test('el_mecanico_no_recibe_precio_de_venta_precio_unitario_importe_de_linea_ni_total_en_ninguna_ruta', async () => {
    const prohibidos = ['salePrice', 'unitPrice', VENTA, IMPORTE_LINEA, TOTAL_ORDEN];
    const fugas = [];
    for (const { ruta, texto } of await recorrer('MECHANIC')) {
      for (const prohibido of prohibidos) if (texto.includes(prohibido)) fugas.push(`${ruta} contiene ${prohibido}`);
    }
    expect(fugas).toEqual([]);
  });

  test('el_mecanico_no_recibe_la_clave_total_en_el_listado_ni_en_el_detalle_de_la_orden', async () => {
    const listado = await request(app).get('/api/orders').set(como('MECHANIC'));
    expect(listado.status).toBe(200);
    expect(listado.body.data.length).toBeGreaterThan(0);
    for (const orden of listado.body.data) expect(orden).not.toHaveProperty('total');
    const detalle = await request(app).get(`/api/orders/${ordenId}`).set(como('MECHANIC'));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data).not.toHaveProperty('total');
    expect(detalle.body.data.parts[0]).not.toHaveProperty('amount');
    const historial = await request(app).get(`/api/vehicles/${datos.vehicleId}/history`).set(como('MECHANIC'));
    expect(historial.body.data.length).toBeGreaterThan(0);
    for (const entrada of historial.body.data) expect(entrada).not.toHaveProperty('total');
  });

  test('los_pagos_el_ticket_y_el_panel_responden_403_al_mecanico', async () => {
    const vedadas = [`/api/orders/${ordenId}/payments`, `/api/orders/${ordenId}/ticket`, '/api/dashboard'];
    for (const ruta of vedadas) {
      expect((await request(app).get(ruta).set(como('MECHANIC'))).status).toBe(403);
    }
  });

  // Controles positivos: sin ellos la prueba podría pasar vacía.
  test('control_positivo_el_administrador_si_recibe_el_precio_de_compra_y_el_de_venta', async () => {
    const respuesta = await request(app).get(`/api/parts/${parteId}`).set(como('ADMIN'));
    expect(respuesta.body.data).toMatchObject({ purchasePrice: '73.41', salePrice: '188.88' });
  });

  test('control_positivo_recepcion_si_recibe_el_precio_de_venta_el_importe_y_el_total', async () => {
    const parte = await request(app).get(`/api/parts/${parteId}`).set(como('RECEPTIONIST'));
    expect(parte.body.data.salePrice).toBe(VENTA);
    const detalle = await request(app).get(`/api/orders/${ordenId}`).set(como('RECEPTIONIST'));
    expect(detalle.body.data.total).toBe(TOTAL_ORDEN);
    expect(detalle.body.data.parts[0]).toMatchObject({ unitPrice: VENTA, amount: IMPORTE_LINEA });
  });
});
