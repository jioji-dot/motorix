// Total de la orden con refacciones, en centavos (Sprint 5, FR-011): servicios + mano de obra + refacciones.
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
const admin = (metodo, ruta, cuerpo) => request(app)[metodo](ruta).set(como('ADMIN')).send(cuerpo);
const total = async (orden) => (await admin('get', `/api/orders/${orden}`)).body.data.total;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Total de la orden con refacciones (integración, Sprint 5)', () => {
  test('el_total_es_servicios_mas_mano_de_obra_redondeada_al_centavo_mas_refacciones', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 80, salePrice: 150 });
    await admin('post', `/api/orders/${orden}/services`, { description: 'Servicio', amount: 850 });
    // 2.5 h × 99.99 = 249.975 → 249.98 (las mitades suben)
    const labor = await admin('post', `/api/orders/${orden}/labor`, { description: 'Mano de obra', hours: 2.5, hourlyRate: 99.99 });
    expect(labor.body.data.labor[0].amount).toBe('249.98');
    await admin('post', `/api/orders/${orden}/parts`, { partId: id, quantity: 2 });
    expect(await total(orden)).toBe('1399.98'); // 850.00 + 249.98 + 300.00
  });

  test('la_mano_de_obra_se_redondea_al_centavo_mas_cercano_con_las_mitades_hacia_arriba', async () => {
    const orden = await nuevaOrden();
    const redondeos = [
      [0.01, 0.5, '0.01'], // 0.005 → 0.01
      [0.01, 0.49, '0.00'], // 0.0049 → 0.00
      [1.25, 333.33, '416.66'], // 416.6625 → 416.66
      [3, 0.1, '0.30'],
    ];
    for (const [hours, hourlyRate, esperado] of redondeos) {
      const respuesta = await admin('post', `/api/orders/${orden}/labor`, { description: 'Redondeo', hours, hourlyRate });
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.data.labor.at(-1).amount).toBe(esperado);
    }
    expect(await total(orden)).toBe('416.97'); // 0.01 + 0.00 + 416.66 + 0.30
  });

  test('el_total_se_recalcula_al_agregar_cambiar_y_quitar_refacciones_sin_error_acumulado', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 10, purchasePrice: 0.05, salePrice: 0.1 });
    const alta = await admin('post', `/api/orders/${orden}/parts`, { partId: id, quantity: 3 });
    expect(alta.body.data.total).toBe('0.30'); // 3 × 0.10 sin el error de 0.30000000000000004
    const lineId = alta.body.data.parts[0].id;
    expect((await admin('patch', `/api/orders/${orden}/parts/${lineId}`, { quantity: 7 })).body.data.total).toBe('0.70');
    expect((await admin('delete', `/api/orders/${orden}/parts/${lineId}`)).body.data.total).toBe('0.00');
  });

  test('una_refaccion_con_precio_0_agrega_una_linea_de_importe_0_y_no_cambia_el_total', async () => {
    const orden = await nuevaOrden();
    const { id } = await crearRefaccion({ stock: 5, purchasePrice: 0, salePrice: 0 });
    await admin('post', `/api/orders/${orden}/services`, { description: 'Servicio', amount: 100 });
    const alta = await admin('post', `/api/orders/${orden}/parts`, { partId: id, quantity: 2 });
    expect(alta.status).toBe(201);
    expect(alta.body.data.parts[0]).toMatchObject({ unitPrice: '0.00', amount: '0.00' });
    expect(alta.body.data.total).toBe('100.00');
  });
});
