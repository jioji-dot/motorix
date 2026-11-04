// El panel de control y los listados de órdenes y pagos con refacciones coinciden con sus fuentes (Sprint 5, FR-019).
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

let usuarios;
let ordenId;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const leer = async (ruta, rol = 'ADMIN') => (await request(app).get(ruta).set(como(rol))).body;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const datos = await crearClienteConVehiculo();
  // Orden Terminada de 700.00 (servicio de 500.00 y dos piezas de 100.00) con un pago parcial de 300.00.
  ordenId = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 500 });
  const parte = await crearRefaccion({ stock: 20, purchasePrice: 40, salePrice: 100 });
  await crearLineaDeRefaccion({ orderId: ordenId, partId: parte.id, quantity: 2 });
  await crearPago({ orderId: ordenId, createdBy: usuarios.RECEPTIONIST.id, amount: 300 });
});

afterAll(cerrarConexiones);

describe('Panel y listados con el total que incluye refacciones (integración, Sprint 5)', () => {
  test('el_listado_de_ordenes_muestra_el_total_con_refacciones_a_recepcion_y_administracion', async () => {
    for (const rol of ['ADMIN', 'RECEPTIONIST']) {
      const lista = await leer('/api/orders?pageSize=100', rol);
      expect(lista.data.find((o) => o.id === ordenId).total).toBe('700.00');
    }
  });

  test('el_resumen_de_pagos_de_la_orden_usa_el_total_con_refacciones', async () => {
    const { data } = await leer(`/api/orders/${ordenId}/payments`);
    expect(data.summary).toMatchObject({ total: '700.00', paid: '300.00', balance: '400.00', status: 'PARCIAL' });
  });

  test('el_panel_cuenta_lo_pendiente_y_lo_cobrado_con_el_total_con_refacciones', async () => {
    const { data } = await leer('/api/dashboard');
    expect(data.orders.withBalance).toEqual({ count: 1, amount: '400.00' });
    expect(data.payments.pendingToCollect).toBe('400.00');
    expect(data.payments.collectedToday).toBe('300.00');
  });

  test('las_cifras_del_panel_coinciden_con_el_resumen_de_cada_orden', async () => {
    const { data } = await leer('/api/dashboard');
    const { data: resumen } = await leer(`/api/orders/${ordenId}/payments`);
    expect(data.payments.pendingToCollect).toBe(resumen.summary.balance);
    expect(data.orders.withBalance.amount).toBe(resumen.summary.balance);
  });

  test('el_mecanico_no_ve_totales_en_el_listado_de_ordenes_y_el_panel_y_los_pagos_le_responden_403', async () => {
    const lista = await leer('/api/orders?pageSize=100', 'MECHANIC');
    expect(lista.data.length).toBeGreaterThan(0);
    for (const orden of lista.data) expect(orden).not.toHaveProperty('total');
    expect((await request(app).get('/api/dashboard').set(como('MECHANIC'))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${ordenId}/payments`).set(como('MECHANIC'))).status).toBe(403);
  });
});
