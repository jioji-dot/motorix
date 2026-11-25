// Ninguna respuesta expone el hash, el token ni precios reservados al rol (Sprint 7, FR-030).
import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones, crearClienteConVehiculo, crearLineaDeRefaccion, crearOrdenCobrable, crearPago, crearRefaccion, crearUsuariosDePrueba, limpiarBase,
} from '../helpers.js';

let usuarios;
let orden;
let parte;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const c = await crearClienteConVehiculo();
  parte = await crearRefaccion({ stock: 10, minimumStock: 2, purchasePrice: 77.77, salePrice: 123.45 });
  orden = await crearOrdenCobrable({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  await crearLineaDeRefaccion({ orderId: orden, partId: parte.id, quantity: 1 });
  await crearPago({ orderId: orden, createdBy: usuarios.ADMIN.id, amount: 100 });
  await request(app).post(`/api/orders/${orden}/ticket`).set({ Authorization: `Bearer ${usuarios.ADMIN.token}` });
});
afterAll(cerrarConexiones);

const ENDPOINTS = () => [
  '/api/users', `/api/users/${usuarios.ADMIN.id}`, '/api/auth/me', '/api/parts', `/api/parts/${parte.id}`, '/api/orders', `/api/orders/${orden}`,
  `/api/orders/${orden}/payments`, `/api/orders/${orden}/ticket`, '/api/notifications', '/api/maintenance', '/api/dashboard',
];
const SECRETOS = /passwordHash|"token"|failedAttempts|lockedUntil|\$2[aby]\$/;

test.each(['ADMIN', 'RECEPTIONIST', 'MECHANIC'])('ninguna_respuesta_del_rol_%s_incluye_hash_token_ni_datos_de_bloqueo', async (rol) => {
  for (const ruta of ENDPOINTS()) {
    const r = await request(app).get(ruta).set({ Authorization: `Bearer ${usuarios[rol].token}` });
    expect(JSON.stringify(r.body)).not.toMatch(SECRETOS);
  }
});

test('el_mecanico_no_recibe_precios_de_refacciones_ni_el_total', async () => {
  for (const ruta of ['/api/parts', `/api/parts/${parte.id}`, `/api/orders/${orden}`]) {
    const r = await request(app).get(ruta).set({ Authorization: `Bearer ${usuarios.MECHANIC.token}` });
    const texto = JSON.stringify(r.body);
    expect(texto).not.toMatch(/purchasePrice|salePrice|unitPrice/);
    expect(texto).not.toContain('123.45');
    expect(texto).not.toContain('77.77');
  }
});

test('recepcion_no_recibe_el_precio_de_compra', async () => {
  for (const ruta of ['/api/parts', `/api/parts/${parte.id}`]) {
    const r = await request(app).get(ruta).set({ Authorization: `Bearer ${usuarios.RECEPTIONIST.token}` });
    expect(JSON.stringify(r.body)).not.toMatch(/purchasePrice|77\.77/);
  }
});

test('el_inicio_de_sesion_devuelve_el_token_pero_nunca_el_hash', async () => {
  const r = await request(app).post('/api/auth/login').send({ identifier: 'admin', password: 'Prueba2026!' });
  expect(r.body.data.token).toBeTruthy();
  expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
});
