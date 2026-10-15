// Matriz completa de permisos del Sprint 3 (contracts/api.md): cada operación contra cada rol,
// sobre `motorix_test`. Complementa a sprint3Permissions.test.js (mantenimientos).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createOrder,
  createOrderPart,
  createPart,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();
const ROLES = ['ADMIN', 'RECEPTIONIST', 'MECHANIC', 'OTHER_MECHANIC'];

let usuarios;
let cliente;
let vehiculo;
let pieza;
let orden;
let linea;
let secuencia = 0;

/** Cada operación recibe la cabecera de autorización y devuelve la petición lista. */
const operaciones = () => [
  {
    nombre: 'GET /api/vehicles/:id/history',
    enviar: (auth) => request(app).get(`/api/vehicles/${vehiculo.id}/history`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 200, MECHANIC: 200, OTHER_MECHANIC: 200 }
  },
  {
    nombre: 'GET /api/vehicles/:id/maintenance',
    enviar: (auth) => request(app).get(`/api/vehicles/${vehiculo.id}/maintenance`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 200, MECHANIC: 200, OTHER_MECHANIC: 200 }
  },
  {
    nombre: 'GET /api/maintenance',
    enviar: (auth) => request(app).get('/api/maintenance').set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 200, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'GET /api/parts',
    enviar: (auth) => request(app).get('/api/parts').set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'GET /api/parts/:id',
    enviar: (auth) => request(app).get(`/api/parts/${pieza.id}`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'GET /api/parts/alerts',
    enviar: (auth) => request(app).get('/api/parts/alerts').set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'GET /api/parts/available',
    enviar: (auth) => request(app).get('/api/parts/available?search=ref').set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 200, OTHER_MECHANIC: 200 }
  },
  {
    nombre: 'GET /api/parts/:id/movements',
    enviar: (auth) => request(app).get(`/api/parts/${pieza.id}/movements`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'POST /api/parts',
    enviar: (auth) =>
      request(app)
        .post('/api/parts')
        .set('Authorization', auth)
        .send({ code: `NUEVA-${(secuencia += 1)}`, name: 'Nueva', price: 10 }),
    esperado: { ADMIN: 201, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'PATCH /api/parts/:id',
    enviar: (auth) => request(app).patch(`/api/parts/${pieza.id}`).set('Authorization', auth).send({ name: 'Editada' }),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'POST /api/parts/:id/entries',
    enviar: (auth) =>
      request(app).post(`/api/parts/${pieza.id}/entries`).set('Authorization', auth).send({ quantity: 1, reason: 'Compra' }),
    esperado: { ADMIN: 201, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'POST /api/parts/:id/adjustments',
    enviar: (auth) =>
      request(app).post(`/api/parts/${pieza.id}/adjustments`).set('Authorization', auth).send({ newStock: 10, reason: 'Conteo' }),
    esperado: { ADMIN: 201, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'POST /api/parts/:id/deactivate',
    enviar: (auth) => request(app).post(`/api/parts/${pieza.id}/deactivate`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'POST /api/parts/:id/activate',
    enviar: (auth) => request(app).post(`/api/parts/${pieza.id}/activate`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 403, OTHER_MECHANIC: 403 }
  },
  {
    nombre: 'GET /api/orders/:id (la recepción ve las refacciones en solo lectura)',
    enviar: (auth) => request(app).get(`/api/orders/${orden.id}`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 200, MECHANIC: 200, OTHER_MECHANIC: 404 }
  },
  {
    nombre: 'POST /api/orders/:id/parts',
    enviar: (auth) =>
      request(app).post(`/api/orders/${orden.id}/parts`).set('Authorization', auth).send({ partId: pieza.id, quantity: 1 }),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 200, OTHER_MECHANIC: 404 }
  },
  {
    nombre: 'PATCH /api/orders/:id/parts/:orderPartId',
    enviar: (auth) =>
      request(app).patch(`/api/orders/${orden.id}/parts/${linea.id}`).set('Authorization', auth).send({ quantity: 2 }),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 200, OTHER_MECHANIC: 404 }
  },
  {
    nombre: 'DELETE /api/orders/:id/parts/:orderPartId',
    enviar: (auth) => request(app).delete(`/api/orders/${orden.id}/parts/${linea.id}`).set('Authorization', auth),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 200, OTHER_MECHANIC: 404 }
  },
  {
    nombre: 'PATCH /api/orders/:id/work con kilometraje de servicio',
    enviar: (auth) =>
      request(app).patch(`/api/orders/${orden.id}/work`).set('Authorization', auth).send({ serviceMileage: 5000 }),
    esperado: { ADMIN: 200, RECEPTIONIST: 403, MECHANIC: 200, OTHER_MECHANIC: 404 }
  }
];

/** Deja los datos como al inicio para que una operación no afecte a la siguiente. */
async function reiniciarDatos() {
  await pool.query('DELETE FROM order_parts');
  await pool.query('DELETE FROM inventory_movements WHERE order_id IS NOT NULL');
  await pool.query('UPDATE parts SET active = 1 WHERE id = ?', [pieza.id]);
  await pool.query('UPDATE service_orders SET service_mileage = NULL WHERE id = ?', [orden.id]);
  await pool.query('UPDATE vehicles SET current_mileage = 1000 WHERE id = ?', [vehiculo.id]);
  linea = await createOrderPart(orden.id, pieza.id, { quantity: 1, unitPrice: 100 });
}

beforeEach(async () => {
  await cleanTables();
  const mecanico = await createAuthenticated('MECHANIC');
  usuarios = {
    ADMIN: await createAuthenticated('ADMIN'),
    RECEPTIONIST: await createAuthenticated('RECEPTIONIST'),
    MECHANIC: mecanico,
    OTHER_MECHANIC: await createAuthenticated('MECHANIC')
  };
  cliente = await createClient();
  vehiculo = await createVehicle(cliente.id, { currentMileage: 1000 });
  pieza = await createPart({ code: 'REF-MATRIZ', name: 'Refacción de la matriz', stock: 50, minimumStock: 5 });
  orden = await createOrder({
    clientId: cliente.id,
    vehicleId: vehiculo.id,
    mechanicId: mecanico.user.id,
    status: 'EN_REPARACION',
    entryMileage: 1000
  });
  linea = await createOrderPart(orden.id, pieza.id, { quantity: 1, unitPrice: 100 });
});
afterAll(closePool);

describe('matriz de permisos del Sprint 3', () => {
  test('test_cada_operacion_responde_lo_que_indica_la_matriz_para_cada_rol', async () => {
    const fallos = [];
    const total = operaciones().length;

    for (let i = 0; i < total; i += 1) {
      for (const rol of ROLES) {
        await reiniciarDatos();
        const operacion = operaciones()[i];
        const res = await operacion.enviar(usuarios[rol].auth);
        if (res.status !== operacion.esperado[rol]) {
          fallos.push(`${operacion.nombre} como ${rol}: esperado ${operacion.esperado[rol]}, recibido ${res.status}`);
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  test('test_una_operacion_rechazada_por_permiso_no_cambia_el_inventario', async () => {
    const antes = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);

    await operaciones()[10].enviar(usuarios.RECEPTIONIST.auth); // entrada de inventario
    await operaciones()[11].enviar(usuarios.MECHANIC.auth); // ajuste de inventario
    await operaciones()[16].enviar(usuarios.RECEPTIONIST.auth); // refacción en la orden

    const despues = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(despues[0][0].stock).toBe(antes[0][0].stock);
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM inventory_movements WHERE type <> 'IN'");
    expect(total).toBe(0);
  });

  test('test_la_recepcion_ve_las_refacciones_de_la_orden_en_solo_lectura', async () => {
    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', usuarios.RECEPTIONIST.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.parts).toHaveLength(1);
    expect(res.body.data.editable.parts).toBe(false);
  });

  test('test_todas_las_rutas_nuevas_exigen_autenticacion', async () => {
    const respuestas = await Promise.all([
      request(app).get(`/api/vehicles/${vehiculo.id}/history`),
      request(app).get('/api/parts'),
      request(app).get('/api/parts/alerts'),
      request(app).get('/api/parts/available?search=ref'),
      request(app).get(`/api/parts/${pieza.id}/movements`),
      request(app).post(`/api/parts/${pieza.id}/entries`).send({}),
      request(app).post(`/api/orders/${orden.id}/parts`).send({}),
      request(app).delete(`/api/orders/${orden.id}/parts/${linea.id}`),
      request(app).get('/api/maintenance')
    ]);

    for (const res of respuestas) expect(res.status).toBe(401);
  });
});
