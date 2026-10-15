// SC-007: la búsqueda de clientes responde en menos de 2 segundos con al menos 500 clientes.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated } from '../helpers/factories.js';

const app = createApp();
const TOTAL_CLIENTES = 500;
const LIMITE_MS = 2000;

beforeAll(async () => {
  await cleanTables();
  const filas = [];
  for (let i = 1; i <= TOTAL_CLIENTES; i += 1) {
    filas.push([
      `Cliente Número ${String(i).padStart(4, '0')}`,
      `55${String(20000000 + i)}`,
      `cliente${i}@correo.mx`,
      `Calle ${i}, Colonia Centro`
    ]);
  }
  await pool.query('INSERT INTO clients (name, phone, email, address) VALUES ?', [filas]);
});

afterAll(async () => {
  await cleanTables();
  await closePool();
});

describe('rendimiento de la búsqueda de clientes', () => {
  test('test_busca_por_nombre_con_500_clientes_en_menos_de_2_segundos', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const inicio = Date.now();
    const res = await request(app).get('/api/clients?search=0250').set('Authorization', auth);
    const duracion = Date.now() - inicio;

    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.name)).toEqual(['Cliente Número 0250']);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_busca_por_telefono_y_correo_con_500_clientes_en_menos_de_2_segundos', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const inicio = Date.now();
    const porTelefono = await request(app).get('/api/clients?search=5520000123').set('Authorization', auth);
    const porCorreo = await request(app).get('/api/clients?search=cliente321@').set('Authorization', auth);
    const duracion = Date.now() - inicio;

    expect(porTelefono.body.data).toHaveLength(1);
    expect(porCorreo.body.data).toHaveLength(1);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_el_listado_paginado_sin_filtro_responde_en_menos_de_2_segundos', async () => {
    const { auth } = await createAuthenticated('MECHANIC');

    const inicio = Date.now();
    const res = await request(app).get('/api/clients?page=5&pageSize=100').set('Authorization', auth);
    const duracion = Date.now() - inicio;

    expect(res.body.meta).toEqual({ page: 5, pageSize: 100, total: TOTAL_CLIENTES });
    expect(res.body.data).toHaveLength(100);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });
});
