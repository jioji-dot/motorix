// Cambio de precio y alta de la línea al mismo tiempo (Sprint 5, FR-010): la línea toma un precio que la refacción
// tuvo de verdad (el anterior o el nuevo), nunca otro valor.
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

const REPETICIONES = 8;
let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Concurrencia del precio guardado (integración, Sprint 5)', () => {
  test('el_cambio_de_precio_y_el_alta_simultaneos_dejan_la_linea_con_el_precio_anterior_o_el_nuevo', async () => {
    for (let i = 0; i < REPETICIONES; i += 1) {
      const orden = await nuevaOrden();
      const { id } = await crearRefaccion({ stock: 10, purchasePrice: 50, salePrice: 100 });
      const [cambio, alta] = await Promise.all([
        request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send({ salePrice: 300 }),
        request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId: id, quantity: 1 }),
      ]);
      expect(cambio.status).toBe(200);
      expect(alta.status).toBe(201);
      const detalle = (await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'))).body.data;
      expect(['100.00', '300.00']).toContain(detalle.parts[0].unitPrice);
      expect(detalle.total).toBe(detalle.parts[0].unitPrice);
    }
  });

  test('el_alta_simultanea_con_la_desactivacion_o_con_otra_edicion_nunca_deja_un_precio_inventado', async () => {
    for (let i = 0; i < REPETICIONES; i += 1) {
      const orden = await nuevaOrden();
      const { id } = await crearRefaccion({ stock: 10, purchasePrice: 50, salePrice: 100 });
      const [edicion, alta] = await Promise.all([
        request(app).patch(`/api/parts/${id}`).set(como('ADMIN')).send(i % 2 === 0 ? { active: false } : { name: 'Renombrada', salePrice: 120 }),
        request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId: id, quantity: 1 }),
      ]);
      expect(edicion.status).toBe(200);
      expect([201, 409]).toContain(alta.status);
      const detalle = (await request(app).get(`/api/orders/${orden}`).set(como('ADMIN'))).body.data;
      if (alta.status === 201) {
        expect(['100.00', '120.00']).toContain(detalle.parts[0].unitPrice);
      } else {
        expect(alta.body.error.code).toBe('PART_INACTIVE');
        expect(detalle.parts).toEqual([]);
        expect(detalle.total).toBe('0.00');
      }
    }
  });
});
