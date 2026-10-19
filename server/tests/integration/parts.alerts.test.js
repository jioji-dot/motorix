import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearRefaccion,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const resumen = async () => (await request(app).get('/api/parts/summary').set(como('ADMIN'))).body.data;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('Alertas de stock bajo (integración)', () => {
  test('el_resumen_cuenta_bien_cada_nivel_e_ignora_las_refacciones_inactivas', async () => {
    await crearRefaccion({ stock: 30, minimumStock: 5 });
    await crearRefaccion({ stock: 6, minimumStock: 5 });
    await crearRefaccion({ stock: 5, minimumStock: 5 });
    await crearRefaccion({ stock: 2, minimumStock: 5 });
    await crearRefaccion({ stock: 0, minimumStock: 5 });
    await crearRefaccion({ stock: 0, minimumStock: 5, active: 0 });
    expect(await resumen()).toEqual({ total: 5, ok: 2, low: 2, out: 1 });
  });

  test('una_entrada_que_supera_el_minimo_hace_desaparecer_la_alerta', async () => {
    const { id } = await crearRefaccion({ stock: 1, minimumStock: 4 });
    const antes = await resumen();
    const bajas = await request(app).get('/api/parts?stockLevel=LOW').set(como('MECHANIC'));
    expect(bajas.body.data.map((p) => p.id)).toContain(id);
    await request(app).post(`/api/parts/${id}/movements`).set(como('ADMIN')).send({ type: 'IN', quantity: 10, reason: 'Compra' });
    const despues = await resumen();
    expect(despues.low).toBe(antes.low - 1);
    expect(despues.ok).toBe(antes.ok + 1);
    const ahora = await request(app).get('/api/parts?stockLevel=LOW,OUT').set(como('MECHANIC'));
    expect(ahora.body.data.map((p) => p.id)).not.toContain(id);
  });

  test('usar_en_una_orden_la_pieza_que_deja_el_stock_en_el_minimo_dispara_la_alerta_de_inmediato', async () => {
    const datos = await crearClienteConVehiculo();
    const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
    const { id } = await crearRefaccion({ stock: 6, minimumStock: 5 });
    const antes = await resumen();
    await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId: id, quantity: 1 });
    const despues = await resumen();
    expect(despues.low).toBe(antes.low + 1);
    const detalle = await request(app).get(`/api/parts/${id}`).set(como('RECEPTIONIST'));
    expect(detalle.body.data.stockLevel).toBe('LOW');
    await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId: id, quantity: 1 }); // duplicado: sin efecto
    const agotar = await request(app).patch(`/api/orders/${orden}/parts/${(await request(app).get(`/api/orders/${orden}`).set(como('MECHANIC'))).body.data.parts[0].id}`).set(como('MECHANIC')).send({ quantity: 6 });
    expect(agotar.status).toBe(200);
    expect((await request(app).get(`/api/parts/${id}`).set(como('ADMIN'))).body.data.stockLevel).toBe('OUT');
    expect((await resumen()).out).toBe(antes.out + 1);
  });

  test('desactivar_una_refaccion_agotada_la_saca_del_resumen', async () => {
    const { id } = await crearRefaccion({ stock: 0, minimumStock: 3 });
    const antes = await resumen();
    await request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ active: false });
    expect((await resumen()).out).toBe(antes.out - 1);
  });
});
