// Pruebas de contrato de GET /api/parts/alerts y del filtro `alert` de GET /api/parts
// (ver specs/003-historial-inventario/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createPart } from '../helpers/factories.js';

const app = createApp();

let auth;

beforeEach(async () => {
  await cleanTables();
  ({ auth } = await createAuthenticated('ADMIN'));
});
afterAll(closePool);

describe('contrato de alertas de stock', () => {
  test('test_el_resumen_devuelve_low_out_y_total', async () => {
    await createPart({ stock: 2, minimumStock: 5 });
    await createPart({ stock: 0, minimumStock: 5 });
    await createPart({ stock: 50, minimumStock: 5 });

    const res = await request(app).get('/api/parts/alerts').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { low: 1, out: 1, total: 2 } });
  });

  test('test_sin_alertas_devuelve_ceros', async () => {
    await createPart({ stock: 50, minimumStock: 5 });

    const res = await request(app).get('/api/parts/alerts').set('Authorization', auth);

    expect(res.body.data).toEqual({ low: 0, out: 0, total: 0 });
  });

  test('test_el_filtro_alert_del_listado_devuelve_refacciones_con_stockstatus', async () => {
    await createPart({ code: 'BAJA', stock: 2, minimumStock: 5 });
    await createPart({ code: 'OK', stock: 20, minimumStock: 5 });

    const res = await request(app).get('/api/parts?alert=ANY').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ code: 'BAJA', stockStatus: 'LOW' })]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  test('test_un_valor_invalido_del_filtro_responde_400', async () => {
    const res = await request(app).get('/api/parts?alert=NADA').set('Authorization', auth);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('alert');
  });

  test('test_alerts_no_se_confunde_con_el_detalle_de_una_refaccion', async () => {
    const res = await request(app).get('/api/parts/alerts').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('code');
  });
});
