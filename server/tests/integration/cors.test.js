import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

describe('CORS para la aplicación web', () => {
  test('test_permite_el_origen_localhost_en_desarrollo', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5000');
  });

  test('test_responde_204_al_preflight_con_authorization', async () => {
    const res = await request(app)
      .options('/api/clients')
      .set('Origin', 'http://localhost:5000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toMatch(/Authorization/);
    expect(res.headers['access-control-allow-methods']).toMatch(/PATCH/);
  });

  test('test_no_habilita_origenes_externos', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://sitio-externo.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('test_permite_leer_la_respuesta_desde_otro_origen', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});
