// El ticket muestra las refacciones con su precio y su importe, y su subtotal coincide con el total (Sprint 5, FR-018).
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
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const ticket = (orden) => request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Ticket con refacciones (integración, Sprint 5)', () => {
  test('cada_refaccion_aparece_con_cantidad_precio_unitario_e_importe_y_el_subtotal_coincide_con_el_total', async () => {
    const orden = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 500 });
    const filtro = await crearRefaccion({ stock: 20, purchasePrice: 40, salePrice: 110, name: 'Filtro de aceite' });
    const disco = await crearRefaccion({ stock: 20, purchasePrice: 400, salePrice: 1250.5, name: 'Disco de freno' });
    await crearLineaDeRefaccion({ orderId: orden, partId: filtro.id, quantity: 2 });
    await crearLineaDeRefaccion({ orderId: orden, partId: disco.id, quantity: 1 });

    const { body, status } = await ticket(orden);
    expect([200, 201]).toContain(status);
    expect(body.data.parts).toEqual([
      { name: 'Filtro de aceite', quantity: 2, unitPrice: '110.00', amount: '220.00' },
      { name: 'Disco de freno', quantity: 1, unitPrice: '1250.50', amount: '1250.50' },
    ]);
    expect(body.data.subtotal).toBe('1970.50'); // 500.00 + 220.00 + 1250.50
    expect(body.data.total).toBe('1970.50');
    expect(body.data.subtotal).toBe(body.data.total);
  });

  test('con_un_pago_parcial_el_total_sigue_siendo_el_de_la_orden_y_el_saldo_el_que_falta', async () => {
    const orden = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 300 });
    const parte = await crearRefaccion({ stock: 20, purchasePrice: 40, salePrice: 100 });
    await crearLineaDeRefaccion({ orderId: orden, partId: parte.id, quantity: 3 });
    await crearPago({ orderId: orden, createdBy: usuarios.RECEPTIONIST.id, amount: 250 });

    const { body } = await ticket(orden);
    expect(body.data.subtotal).toBe('600.00');
    expect(body.data.total).toBe('600.00');
    expect(body.data.payment).toMatchObject({ status: 'PARCIAL', paid: '250.00', balance: '350.00' });
  });

  test('una_refaccion_de_precio_0_aparece_con_importe_0_00_y_no_altera_el_subtotal', async () => {
    const orden = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 200 });
    const gratis = await crearRefaccion({ stock: 20, purchasePrice: 0, salePrice: 0, name: 'Pieza de garantía' });
    await crearLineaDeRefaccion({ orderId: orden, partId: gratis.id, quantity: 1 });
    const { body } = await ticket(orden);
    expect(body.data.parts).toEqual([{ name: 'Pieza de garantía', quantity: 1, unitPrice: '0.00', amount: '0.00' }]);
    expect(body.data.subtotal).toBe('200.00');
    expect(body.data.total).toBe('200.00');
  });
});
