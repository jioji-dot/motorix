// Avisos de stock bajo y agotado: solo para el administrador, con la insignia de Inventario (FR-004, FR-006, FR-012).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const consultar = async (usuario) => (await request(app).get('/api/notifications').set('Authorization', `Bearer ${usuario.token}`)).body.data;
const grupo = (data, tipo) => data.groups.find((g) => g.type === tipo);

test('el_administrador_recibe_stock_bajo_y_agotado_con_existencia_frente_al_minimo', async () => {
  const agotada = await crearRefaccion({ stock: 0, minimumStock: 3, name: 'Bujía de prueba' });
  const baja = await crearRefaccion({ stock: 2, minimumStock: 2, name: 'Filtro de prueba' });
  const normal = await crearRefaccion({ stock: 9, minimumStock: 2 });
  const inactiva = await crearRefaccion({ stock: 0, minimumStock: 2, active: 0 });

  const data = await consultar(usuarios.ADMIN);
  const out = grupo(data, 'STOCK_OUT').items;
  const low = grupo(data, 'STOCK_LOW').items;
  expect(out.map((i) => i.key)).toContain(`STOCK:${agotada.id}:AGOTADO`);
  expect(low.map((i) => i.key)).toContain(`STOCK:${baja.id}:BAJO`);
  expect(out.find((i) => i.key === `STOCK:${agotada.id}:AGOTADO`)).toMatchObject({
    target: { kind: 'part', id: agotada.id }, data: { code: agotada.code, name: 'Bujía de prueba', stock: 0, minimumStock: 3 },
  });
  const todas = JSON.stringify(data);
  expect(todas).not.toContain(`STOCK:${normal.id}:`);
  expect(todas).not.toContain(`STOCK:${inactiva.id}:`);
  expect(todas).not.toMatch(/purchasePrice|salePrice/);
});

test('stockAlerts_cuenta_todas_las_alertas_para_la_insignia_de_inventario', async () => {
  const data = await consultar(usuarios.ADMIN);
  expect(data.stockAlerts).toBe(grupo(data, 'STOCK_OUT').total + grupo(data, 'STOCK_LOW').total);
});

test('recepcion_y_mecanico_no_reciben_stock_ni_stockAlerts', async () => {
  for (const usuario of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) {
    const data = await consultar(usuario);
    expect(grupo(data, 'STOCK_OUT')).toBeUndefined();
    expect(grupo(data, 'STOCK_LOW')).toBeUndefined();
    expect(data).not.toHaveProperty('stockAlerts');
  }
});
