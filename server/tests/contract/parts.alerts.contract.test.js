// Contrato de GET /api/parts/summary y del filtro stockLevel de GET /api/parts.
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  await crearRefaccion({ stock: 20, minimumStock: 5 });
  await crearRefaccion({ stock: 5, minimumStock: 5 });
  await crearRefaccion({ stock: 0, minimumStock: 5 });
});

afterAll(cerrarConexiones);

describe('GET /api/parts/summary', () => {
  test('responde_200_con_total_ok_low_y_out_para_los_tres_roles', async () => {
    for (const rol of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const respuesta = await request(app).get('/api/parts/summary').set(como(rol));
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ data: { total: 3, ok: 1, low: 1, out: 1 } });
    }
  });

  test('responde_401_sin_token', async () => {
    expect((await request(app).get('/api/parts/summary')).status).toBe(401);
  });
});

describe('GET /api/parts?stockLevel=', () => {
  test('acepta_LOW_OUT_o_LOW_OUT_y_devuelve_el_nivel_de_cada_refaccion', async () => {
    const bajas = await request(app).get('/api/parts?stockLevel=LOW').set(como('MECHANIC'));
    expect(bajas.body.data.map((p) => p.stockLevel)).toEqual(['LOW']);
    const agotadas = await request(app).get('/api/parts?stockLevel=OUT').set(como('MECHANIC'));
    expect(agotadas.body.data.map((p) => p.stockLevel)).toEqual(['OUT']);
    const ambas = await request(app).get('/api/parts?stockLevel=LOW,OUT').set(como('MECHANIC'));
    expect(ambas.body.meta.total).toBe(2);
  });

  test('rechaza_niveles_invalidos_con_400', async () => {
    for (const nivel of ['OK', 'ALTO']) {
      const respuesta = await request(app).get(`/api/parts?stockLevel=${nivel}`).set(como('ADMIN'));
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
