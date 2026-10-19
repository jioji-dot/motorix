import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearMantenimiento,
  crearOrden,
  crearUsuariosDePrueba,
  fechaDia,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let ids;
let ordenPrueba;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const crear = async (extra, km = 50000, nombre) => {
    const datos = await crearClienteConVehiculo({ km, nombre });
    const id = await crearMantenimiento({ vehicleId: datos.vehicleId, createdBy: usuarios.ADMIN.id, ...extra });
    return { id, ...datos };
  };
  ids = {
    vencidoFecha: await crear({ nextDate: fechaDia(-2) }, 50000, 'Ana Vencida'),
    vencidoKm: await crear({ nextMileage: 49000, lastMileage: 30000 }, 50000),
    proximoFecha: await crear({ nextDate: fechaDia(15) }),
    proximoKm: await crear({ nextMileage: 50500, lastMileage: 30000 }),
    normal: await crear({ nextDate: fechaDia(16), nextMileage: 60000, lastMileage: 30000 }),
    atendido: await crear({ nextDate: fechaDia(-30), status: 'ATENDIDO' }),
  };
  ordenPrueba = ids.proximoKm;
});

afterAll(cerrarConexiones);

const idsDe = (cuerpo) => cuerpo.data.map((m) => m.id);

describe('Listado de mantenimientos (integración)', () => {
  test('clasifica_cada_caso_y_oculta_los_atendidos_por_defecto', async () => {
    const respuesta = await request(app).get('/api/maintenance').set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(200);
    const clasificacion = Object.fromEntries(respuesta.body.data.map((m) => [m.id, m.classification]));
    expect(clasificacion).toEqual({
      [ids.vencidoFecha.id]: 'VENCIDO',
      [ids.vencidoKm.id]: 'VENCIDO',
      [ids.proximoFecha.id]: 'PROXIMO',
      [ids.proximoKm.id]: 'PROXIMO',
      [ids.normal.id]: 'NORMAL',
    });
    expect(respuesta.body.data.at(-1).id).toBe(ids.normal.id);
  });

  test('los_limites_de_15_dias_y_500_km_son_proximos_y_16_dias_es_normal', async () => {
    const respuesta = await request(app).get('/api/maintenance').set(como('ADMIN'));
    const por = (id) => respuesta.body.data.find((m) => m.id === id);
    expect(por(ids.proximoFecha.id)).toMatchObject({ classification: 'PROXIMO', daysLeft: 15 });
    expect(por(ids.proximoKm.id)).toMatchObject({ classification: 'PROXIMO', kmLeft: 500 });
    expect(por(ids.normal.id)).toMatchObject({ classification: 'NORMAL', daysLeft: 16 });
  });

  test('filtra_por_clasificacion_y_por_estado', async () => {
    const vencidos = await request(app).get('/api/maintenance?classification=VENCIDO').set(como('MECHANIC'));
    expect(idsDe(vencidos.body).sort()).toEqual([ids.vencidoFecha.id, ids.vencidoKm.id].sort());
    const urgentes = await request(app).get('/api/maintenance?classification=VENCIDO,PROXIMO').set(como('MECHANIC'));
    expect(urgentes.body.meta.total).toBe(4);
    const todos = await request(app).get('/api/maintenance?status=all').set(como('ADMIN'));
    expect(todos.body.meta.total).toBe(6);
    const atendidos = await request(app).get('/api/maintenance?status=ATENDIDO').set(como('ADMIN'));
    expect(idsDe(atendidos.body)).toEqual([ids.atendido.id]);
  });

  test('busca_por_cliente_placas_o_tipo_y_filtra_por_vehiculo_y_cliente', async () => {
    const porNombre = await request(app).get('/api/maintenance?search=Ana').set(como('ADMIN'));
    expect(idsDe(porNombre.body)).toEqual([ids.vencidoFecha.id]);
    const porPlacas = await request(app).get(`/api/maintenance?search=${ids.normal.licensePlate}`).set(como('ADMIN'));
    expect(idsDe(porPlacas.body)).toEqual([ids.normal.id]);
    const porTipo = await request(app).get('/api/maintenance?search=aceite').set(como('ADMIN'));
    expect(porTipo.body.meta.total).toBe(5);
    const porVehiculo = await request(app).get(`/api/maintenance?vehicleId=${ids.normal.vehicleId}`).set(como('ADMIN'));
    expect(idsDe(porVehiculo.body)).toEqual([ids.normal.id]);
    const porCliente = await request(app).get(`/api/maintenance?clientId=${ids.normal.clientId}`).set(como('ADMIN'));
    expect(idsDe(porCliente.body)).toEqual([ids.normal.id]);
  });

  test('recepcion_lee_con_el_telefono_del_cliente', async () => {
    const respuesta = await request(app).get('/api/maintenance').set(como('RECEPTIONIST'));
    expect(respuesta.body.data[0].client.phone).toMatch(/\d{10}/);
  });

  test('una_orden_que_sube_el_kilometraje_reclasifica_el_mantenimiento', async () => {
    const antes = await request(app).get(`/api/maintenance/${ordenPrueba.id}`).set(como('ADMIN'));
    expect(antes.body.data.classification).toBe('PROXIMO');
    const orden = await crearOrden({
      clientId: ordenPrueba.clientId,
      vehicleId: ordenPrueba.vehicleId,
      mechanicId: usuarios.MECHANIC.id,
      createdBy: usuarios.RECEPTIONIST.id,
      status: 'EN_REPARACION',
      entryMileage: 50000,
    });
    const km = await request(app).patch(`/api/orders/${orden}`).set(como('MECHANIC')).send({ serviceMileage: 50600 });
    expect(km.status).toBe(200);
    const despues = await request(app).get(`/api/maintenance/${ordenPrueba.id}`).set(como('ADMIN'));
    expect(despues.body.data).toMatchObject({ classification: 'VENCIDO', kmLeft: -100 });
    await pool.execute('UPDATE vehicles SET currentMileage = 50000 WHERE id = ?', [ordenPrueba.vehicleId]);
  });

  test('pagina_el_resultado', async () => {
    const pagina = await request(app).get('/api/maintenance?pageSize=2&page=2').set(como('ADMIN'));
    expect(pagina.body.data).toHaveLength(2);
    expect(pagina.body.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
  });
});
