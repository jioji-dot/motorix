// Lo ya emitido no cambia al cambiar los precios (Sprint 5, FR-012 y FR-013): el pago, el ticket y el total de una
// orden cobrada conservan su importe y su contenido, y una orden Terminada o Entregada no admite cambios de líneas.
import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearLineaDeRefaccion,
  crearOrdenCobrable,
  crearRefaccion,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

// Orden cobrable: servicio de 500.00 más dos piezas de 100.00 (total 700.00).
async function ordenConRefacciones(status = 'TERMINADO') {
  const orden = await crearOrdenCobrable({
    ...datos,
    mechanicId: usuarios.MECHANIC.id,
    createdBy: usuarios.RECEPTIONIST.id,
    total: 500,
    status,
  });
  const parte = await crearRefaccion({ stock: 20, purchasePrice: 40, salePrice: 100 });
  const linea = await crearLineaDeRefaccion({ orderId: orden, partId: parte.id, quantity: 2 });
  return { orden, parte, linea };
}

const instantanea = async (orden) => ({
  detalle: (await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'))).body.data,
  pagos: (await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'))).body.data,
  ticket: (await request(app).get(`/api/orders/${orden}/ticket`).set(como('ADMIN'))).body.data,
});

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Pagos y tickets emitidos frente a cambios de precio (integración, Sprint 5)', () => {
  test('cambiar_el_precio_de_todas_las_refacciones_no_altera_el_pago_el_ticket_ni_el_total', async () => {
    const { orden, parte } = await ordenConRefacciones();
    const pago = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 700 });
    expect(pago.status).toBe(201);
    const ticket = await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
    expect([200, 201]).toContain(ticket.status);

    const antes = await instantanea(orden);
    expect(antes.detalle.total).toBe('700.00');
    expect(antes.ticket.total).toBe('700.00');
    expect(antes.ticket.parts[0]).toMatchObject({ quantity: 2, unitPrice: '100.00', amount: '200.00' });

    for (const nuevo of [999, 1.5, 0]) {
      const cambio = await request(app)
        .patch(`/api/parts/${parte.id}`)
        .set(como('ADMIN'))
        .send({ salePrice: nuevo, confirmBelowCost: true });
      expect(cambio.status).toBe(200);
    }

    expect(await instantanea(orden)).toEqual(antes);
  });

  test('regenerar_el_ticket_despues_del_cambio_de_precio_devuelve_el_mismo_ticket', async () => {
    const { orden, parte } = await ordenConRefacciones();
    await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 700 });
    const primero = (await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'))).body.data;
    await request(app).patch(`/api/parts/${parte.id}`).set(como('ADMIN')).send({ salePrice: 777 });
    const segundo = (await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'))).body.data;
    expect(segundo).toEqual(primero);
  });

  test.each(['TERMINADO', 'ENTREGADO'])('una_orden_%s_no_admite_agregar_cambiar_ni_quitar_lineas_y_conserva_su_total', async (status) => {
    const { orden, linea } = await ordenConRefacciones(status);
    const otra = await crearRefaccion({ stock: 5, salePrice: 10 });
    const rutas = [
      request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId: otra.id, quantity: 1 }),
      request(app).patch(`/api/orders/${orden}/parts/${linea}`).set(como('ADMIN')).send({ quantity: 5 }),
      request(app).delete(`/api/orders/${orden}/parts/${linea}`).set(como('ADMIN')),
      request(app).post(`/api/orders/${orden}/services`).set(como('ADMIN')).send({ description: 'Extra', amount: 10 }),
    ];
    for (const respuesta of await Promise.all(rutas)) {
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('ORDER_NOT_EDITABLE');
    }
    const detalle = (await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'))).body.data;
    expect(detalle.total).toBe('700.00');
    expect(detalle.parts[0]).toMatchObject({ quantity: 2, unitPrice: '100.00' });
  });
});
