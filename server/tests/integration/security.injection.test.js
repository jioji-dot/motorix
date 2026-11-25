// Los campos de búsqueda se tratan como texto literal (Sprint 7, FR-031).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearClienteConVehiculo, crearMantenimiento, crearOrden, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let clientesAntes;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const c = await crearClienteConVehiculo({ nombre: 'Cliente Normal' });
  await crearOrden({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  await crearRefaccion({ name: 'Filtro normal' });
  await crearMantenimiento({ vehicleId: c.vehicleId, createdBy: usuarios.ADMIN.id, nextMileage: 50000 });
  [[{ n: clientesAntes }]] = await pool.query('SELECT COUNT(*) AS n FROM clients');
});
afterAll(cerrarConexiones);

const LISTADOS = ['/api/clients', '/api/vehicles', '/api/appointments', '/api/orders', '/api/parts', '/api/maintenance', '/api/users'];
const ATAQUES = ["' OR 1=1 --", "'; DROP TABLE clients; --", '" OR ""="', '%', '_', '\\', "admin'/*", '1; SELECT SLEEP(5)'];

test.each(ATAQUES)('el_texto_%j_no_altera_ningun_listado', async (ataque) => {
  for (const ruta of LISTADOS) {
    const r = await request(app).get(ruta).query({ search: ataque }).set({ Authorization: `Bearer ${usuarios.ADMIN.token}` });
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(0);
  }
});

test('las_tablas_siguen_intactas_despues_de_los_intentos', async () => {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM clients');
  expect(n).toBe(clientesAntes);
});

test('una_busqueda_normal_si_encuentra_resultados', async () => {
  const r = await request(app).get('/api/clients').query({ search: 'Normal' }).set({ Authorization: `Bearer ${usuarios.ADMIN.token}` });
  expect(r.body.data).toHaveLength(1);
});

test('un_identificador_de_inicio_de_sesion_con_inyeccion_no_inicia_sesion', async () => {
  const r = await request(app).post('/api/auth/login').send({ identifier: "admin' OR '1'='1", password: "' OR '1'='1" });
  expect(r.status).toBe(401);
});
