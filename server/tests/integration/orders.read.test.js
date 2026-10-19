import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearOrden,
  crearSegundoMecanico,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let mecanico2;
let ordenDe1;
let ordenDe2;
let clienteBusqueda;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const comoMecanico2 = () => ({ Authorization: `Bearer ${mecanico2.token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  mecanico2 = await crearSegundoMecanico();

  const a = await crearClienteConVehiculo({ nombre: 'Cliente Alfa' });
  const b = await crearClienteConVehiculo({ nombre: 'Cliente Beta' });
  clienteBusqueda = b;
  const base = { createdBy: usuarios.RECEPTIONIST.id };
  ordenDe1 = await crearOrden({ ...a, ...base, mechanicId: usuarios.MECHANIC.id, status: 'EN_REPARACION' });
  await crearOrden({ ...a, ...base, mechanicId: usuarios.MECHANIC.id, status: 'DIAGNOSTICO' });
  ordenDe2 = await crearOrden({ ...b, ...base, mechanicId: mecanico2.id, status: 'RECIBIDO' });
});

afterAll(cerrarConexiones);

describe('Consulta de órdenes con dos mecánicos (integración)', () => {
  test('cada_mecanico_ve_solo_las_suyas', async () => {
    const del1 = await request(app).get('/api/orders').set(como('MECHANIC'));
    expect(del1.status).toBe(200);
    expect(del1.body.meta.total).toBe(2);
    expect(del1.body.data.every((o) => o.mechanicId === usuarios.MECHANIC.id)).toBe(true);

    const del2 = await request(app).get('/api/orders').set(comoMecanico2());
    expect(del2.body.meta.total).toBe(1);
    expect(del2.body.data[0].id).toBe(ordenDe2);
  });

  test('un_mecanico_no_puede_forzar_el_filtro_de_otro_mecanico', async () => {
    const respuesta = await request(app).get(`/api/orders?mechanicId=${mecanico2.id}`).set(como('MECHANIC'));
    expect(respuesta.body.data.every((o) => o.mechanicId === usuarios.MECHANIC.id)).toBe(true);
    expect(respuesta.body.meta.total).toBe(2);
  });

  test('un_mecanico_no_puede_abrir_una_orden_ajena_pero_si_la_suya', async () => {
    const ajena = await request(app).get(`/api/orders/${ordenDe2}`).set(como('MECHANIC'));
    expect(ajena.status).toBe(403);
    expect(ajena.body.error.code).toBe('FORBIDDEN');

    const propia = await request(app).get(`/api/orders/${ordenDe1}`).set(como('MECHANIC'));
    expect(propia.status).toBe(200);
    expect(propia.body.data.folio).toBe(`OS-${String(ordenDe1).padStart(6, '0')}`);
    expect(propia.body.data.history).toHaveLength(1);
  });

  test.each(['RECEPTIONIST', 'ADMIN'])('el_rol_%s_ve_todas_las_ordenes_y_cualquier_detalle', async (rol) => {
    const lista = await request(app).get('/api/orders').set(como(rol));
    expect(lista.body.meta.total).toBe(3);
    expect((await request(app).get(`/api/orders/${ordenDe2}`).set(como(rol))).status).toBe(200);
  });

  test('recepcion_filtra_por_estado_por_mecanico_y_por_fecha', async () => {
    const porEstado = await request(app).get('/api/orders?status=RECIBIDO').set(como('RECEPTIONIST'));
    expect(porEstado.body.data.map((o) => o.id)).toEqual([ordenDe2]);

    const porMecanico = await request(app).get(`/api/orders?mechanicId=${usuarios.MECHANIC.id}`).set(como('RECEPTIONIST'));
    expect(porMecanico.body.meta.total).toBe(2);

    const hoy = new Date().toISOString().slice(0, 10);
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect((await request(app).get(`/api/orders?from=${hoy}&to=${hoy}`).set(como('ADMIN'))).body.meta.total).toBe(3);
    expect((await request(app).get(`/api/orders?from=${manana}`).set(como('ADMIN'))).body.meta.total).toBe(0);
  });

  test('busca_por_folio_cliente_y_placas', async () => {
    const porFolio = await request(app).get(`/api/orders?search=OS-${String(ordenDe2).padStart(6, '0')}`).set(como('RECEPTIONIST'));
    expect(porFolio.body.data.map((o) => o.id)).toEqual([ordenDe2]);

    const porCliente = await request(app).get('/api/orders?search=Beta').set(como('RECEPTIONIST'));
    expect(porCliente.body.data.map((o) => o.id)).toEqual([ordenDe2]);

    const porPlacas = await request(app).get(`/api/orders?search=${clienteBusqueda.licensePlate}`).set(como('RECEPTIONIST'));
    expect(porPlacas.body.data.map((o) => o.id)).toEqual([ordenDe2]);
  });

  test('un_mecanico_que_busca_solo_encuentra_dentro_de_sus_ordenes', async () => {
    const respuesta = await request(app).get('/api/orders?search=Beta').set(como('MECHANIC'));
    expect(respuesta.body.meta.total).toBe(0);
  });

  test('ordena_las_mas_recientes_primero', async () => {
    const lista = await request(app).get('/api/orders').set(como('ADMIN'));
    const ids = lista.body.data.map((o) => o.id);
    expect(ids).toEqual([...ids].sort((x, y) => y - x));
  });

  test('un_mecanico_sin_ordenes_recibe_una_lista_vacia', async () => {
    const [resultado] = await pool.execute(
      "INSERT INTO users (username, name, email, passwordHash, role) VALUES ('mecanico.libre', 'Mecánico libre', 'libre@motorix.test', 'x', 'MECHANIC')",
    );
    const jwt = (await import('jsonwebtoken')).default;
    const { env } = await import('../../config/env.js');
    const token = jwt.sign({ sub: resultado.insertId }, env.jwt.secret, { expiresIn: '1h' });
    const respuesta = await request(app).get('/api/orders').set({ Authorization: `Bearer ${token}` });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  });

  test('rechaza_peticiones_sin_token_y_parametros_invalidos', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
    expect((await request(app).get('/api/orders?status=OTRO').set(como('ADMIN'))).status).toBe(400);
    expect((await request(app).get('/api/orders/abc').set(como('ADMIN'))).status).toBe(400);
    expect((await request(app).get('/api/orders/999999').set(como('ADMIN'))).status).toBe(404);
  });
});
