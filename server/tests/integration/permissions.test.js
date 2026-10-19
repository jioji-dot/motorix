// Matriz de permisos de contracts/api.md: cada endpoint protegido se prueba con cada rol y sin token.
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

const TODOS = ['ADMIN', 'RECEPTIONIST', 'MECHANIC'];
const ESCRITURA = ['ADMIN', 'RECEPTIONIST'];
const SOLO_ADMIN = ['ADMIN'];
const AGENDA = ['ADMIN', 'RECEPTIONIST']; // citas y lista de mecánicos
const DOCUMENTA = ['ADMIN', 'MECHANIC']; // servicios y mano de obra (el servicio comprueba la asignación)

// [método, ruta, roles permitidos]. Las escrituras se envían vacías: si el rol está permitido, la
// petición pasa la autorización y la validación la rechaza con 400 (nunca con 401 ni 403).
const MATRIZ = [
  ['get', '/api/auth/me', TODOS],
  ['post', '/api/auth/change-password', TODOS],
  ['get', '/api/users', SOLO_ADMIN],
  ['get', '/api/users/1', SOLO_ADMIN],
  ['post', '/api/users', SOLO_ADMIN],
  ['patch', '/api/users/1', SOLO_ADMIN],
  ['get', '/api/clients', TODOS],
  ['get', '/api/clients/1', TODOS],
  ['post', '/api/clients', ESCRITURA],
  ['patch', '/api/clients/1', ESCRITURA],
  ['get', '/api/vehicles', TODOS],
  ['get', '/api/vehicles/1', TODOS],
  ['post', '/api/vehicles', ESCRITURA],
  ['patch', '/api/vehicles/1', ESCRITURA],
  // Sprint 2: citas
  ['get', '/api/appointments', AGENDA],
  ['get', '/api/appointments/1', AGENDA],
  ['post', '/api/appointments', AGENDA],
  ['patch', '/api/appointments/1', AGENDA],
  ['post', '/api/appointments/1/confirm', AGENDA],
  ['post', '/api/appointments/1/cancel', AGENDA],
  ['get', '/api/mechanics', AGENDA],
  // Sprint 2: órdenes de servicio
  ['get', '/api/orders', TODOS],
  ['get', '/api/orders/1', TODOS],
  ['post', '/api/orders', ESCRITURA],
  ['patch', '/api/orders/1', TODOS],
  ['post', '/api/orders/1/status', TODOS],
  ['post', '/api/orders/1/services', DOCUMENTA],
  ['patch', '/api/orders/1/services/1', DOCUMENTA],
  ['delete', '/api/orders/1/services/1', DOCUMENTA],
  ['post', '/api/orders/1/labor', DOCUMENTA],
  ['patch', '/api/orders/1/labor/1', DOCUMENTA],
  ['delete', '/api/orders/1/labor/1', DOCUMENTA],
  // Sprint 3: historial, mantenimientos, refacciones e inventario
  ['get', '/api/vehicles/1/history', TODOS],
  ['get', '/api/maintenance', TODOS],
  ['get', '/api/maintenance/1', TODOS],
  ['post', '/api/maintenance', DOCUMENTA],
  ['patch', '/api/maintenance/1', DOCUMENTA],
  ['get', '/api/parts', TODOS],
  ['get', '/api/parts/summary', TODOS],
  ['get', '/api/parts/categories', TODOS],
  ['get', '/api/parts/1', TODOS],
  ['get', '/api/parts/1/movements', TODOS],
  ['post', '/api/parts', SOLO_ADMIN],
  ['patch', '/api/parts/1', SOLO_ADMIN],
  ['post', '/api/parts/1/movements', SOLO_ADMIN],
  ['post', '/api/orders/1/parts', DOCUMENTA],
  ['patch', '/api/orders/1/parts/1', DOCUMENTA],
  ['delete', '/api/orders/1/parts/1', DOCUMENTA],
  // Sprint 4: pagos, tickets y panel de control
  ['get', '/api/orders/1/payments', AGENDA],
  ['post', '/api/orders/1/payments', AGENDA],
  ['post', '/api/payments/1/sync', AGENDA],
  ['post', '/api/payments/1/cancel', AGENDA],
  ['post', '/api/orders/1/ticket', AGENDA],
  ['get', '/api/orders/1/ticket', AGENDA],
  ['post', '/api/orders/1/ticket/print-link', AGENDA],
  ['get', '/api/dashboard', SOLO_ADMIN],
];

const enviar = (metodo, ruta, token) => {
  const peticion = request(app)[metodo](ruta);
  if (token) peticion.set('Authorization', `Bearer ${token}`);
  return ['post', 'patch'].includes(metodo) ? peticion.send({}) : peticion;
};

describe('Matriz de permisos por rol (SC-003)', () => {
  test.each(MATRIZ)('%s %s sin token responde 401', async (metodo, ruta) => {
    const respuesta = await enviar(metodo, ruta, null);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  test.each(MATRIZ)('%s %s con un token inválido responde 401', async (metodo, ruta) => {
    expect((await enviar(metodo, ruta, 'token.invalido.falso')).status).toBe(401);
  });

  describe.each(TODOS)('rol %s', (rol) => {
    test.each(MATRIZ)('%s %s respeta el permiso del rol', async (metodo, ruta, permitidos) => {
      const respuesta = await enviar(metodo, ruta, usuarios[rol].token);
      if (permitidos.includes(rol)) {
        expect([401, 403]).not.toContain(respuesta.status);
      } else {
        expect(respuesta.status).toBe(403);
        expect(respuesta.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  test('el_inicio_de_sesion_es_la_unica_ruta_publica', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({});
    expect(respuesta.status).toBe(400); // llega a la validación sin exigir token
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  test('una_ruta_inexistente_responde_404_con_formato_estandar_y_sin_trazas', async () => {
    const respuesta = await request(app).get('/api/no-existe').set('Authorization', `Bearer ${usuarios.ADMIN.token}`);
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });
});

describe('Rutas públicas del Sprint 4 (no exigen sesión pero validan su contenido)', () => {
  test('el_webhook_de_mercado_pago_no_pide_sesion_y_rechaza_lo_mal_formado', async () => {
    const bien = await request(app).post('/api/payments/mercadopago/webhook').send({ type: 'merchant_order', data: { id: '1' } });
    expect(bien.status).toBe(200);
    const mal = await request(app).post('/api/payments/mercadopago/webhook').send({});
    expect(mal.status).toBe(400);
  });

  test('la_pagina_de_impresion_no_pide_sesion_pero_exige_un_token_valido', async () => {
    const respuesta = await request(app).get('/api/tickets/print/un-token-que-no-es-valido');
    expect(respuesta.status).toBe(401);
    expect(respuesta.headers['content-type']).toMatch(/text\/html/);
  });
});
