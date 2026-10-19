import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearCita,
  crearClienteConVehiculo,
  crearSegundoMecanico,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let mecanico2;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  mecanico2 = await crearSegundoMecanico();
});

afterAll(cerrarConexiones);

const crear = (cuerpo, rol = 'RECEPTIONIST') => request(app).post('/api/orders').set(como(rol)).send(cuerpo);

const cuerpoBase = (datos, extra = {}) => ({
  clientId: datos.clientId,
  vehicleId: datos.vehicleId,
  mechanicId: usuarios.MECHANIC.id,
  entryMileage: 45000,
  reportedProblem: 'Ruido en el motor al arrancar',
  ...extra,
});

describe('Alta de órdenes (integración)', () => {
  test('el_mecanico_recibe_403_y_no_se_crea_nada', async () => {
    const datos = await crearClienteConVehiculo();
    const respuesta = await crear(cuerpoBase(datos), 'MECHANIC');
    expect(respuesta.status).toBe(403);
    const [filas] = await pool.query('SELECT COUNT(*) total FROM service_orders');
    expect(filas[0].total).toBe(0);
  });

  test('rechaza_peticiones_sin_token', async () => {
    expect((await request(app).post('/api/orders').send({})).status).toBe(401);
  });

  test.each(['ADMIN', 'RECEPTIONIST'])('el_rol_%s_crea_una_orden_directa_en_estado_recibido_con_folio', async (rol) => {
    const datos = await crearClienteConVehiculo({ km: 40000 });
    const respuesta = await crear(cuerpoBase(datos), rol);
    expect(respuesta.status).toBe(201);
    const orden = respuesta.body.data;
    expect(orden).toMatchObject({
      status: 'RECIBIDO',
      clientId: datos.clientId,
      vehicleId: datos.vehicleId,
      mechanicId: usuarios.MECHANIC.id,
      entryMileage: 45000,
      total: '0.00',
      appointmentId: null,
    });
    expect(orden.folio).toBe(`OS-${String(orden.id).padStart(6, '0')}`);
    expect(orden.mechanic.name).toBe('Mecánico de prueba');
    expect(orden.history).toHaveLength(1);
    expect(orden.history[0]).toMatchObject({ fromStatus: null, toStatus: 'RECIBIDO' });
  });

  test('el_folio_es_unico_y_legible_entre_ordenes', async () => {
    const datos = await crearClienteConVehiculo();
    const a = await crear(cuerpoBase(datos));
    const b = await crear(cuerpoBase(datos, { entryMileage: 46000 }));
    expect(a.body.data.folio).not.toBe(b.body.data.folio);
    expect(a.body.data.folio).toMatch(/^OS-\d{6}$/);
  });

  test('actualiza_el_kilometraje_del_vehiculo_con_el_de_entrada', async () => {
    const datos = await crearClienteConVehiculo({ km: 10000 });
    await crear(cuerpoBase(datos, { entryMileage: 12345 }));
    const [filas] = await pool.execute('SELECT currentMileage FROM vehicles WHERE id = ?', [datos.vehicleId]);
    expect(filas[0].currentMileage).toBe(12345);
  });

  test('rechaza_un_kilometraje_menor_sin_correccion_y_lo_acepta_con_ella', async () => {
    const datos = await crearClienteConVehiculo({ km: 80000 });
    const rechazada = await crear(cuerpoBase(datos, { entryMileage: 70000 }));
    expect(rechazada.status).toBe(409);
    expect(rechazada.body.error.code).toBe('MILEAGE_DECREASE');
    const [intacto] = await pool.execute('SELECT currentMileage FROM vehicles WHERE id = ?', [datos.vehicleId]);
    expect(intacto[0].currentMileage).toBe(80000);

    const corregida = await crear(cuerpoBase(datos, { entryMileage: 70000, mileageCorrection: true }));
    expect(corregida.status).toBe(201);
    const [actualizado] = await pool.execute('SELECT currentMileage FROM vehicles WHERE id = ?', [datos.vehicleId]);
    expect(actualizado[0].currentMileage).toBe(70000);
  });

  test('rechaza_kilometrajes_fuera_de_rango_y_acepta_cualquiera_con_0_km_previos', async () => {
    const datos = await crearClienteConVehiculo({ km: 0 });
    expect((await crear(cuerpoBase(datos, { entryMileage: 1500001 }))).status).toBe(400);
    expect((await crear(cuerpoBase(datos, { entryMileage: -5 }))).status).toBe(400);
    expect((await crear(cuerpoBase(datos, { entryMileage: 1500000 }))).status).toBe(201);
  });

  test('exige_mecanico_activo_con_rol_de_mecanico', async () => {
    const datos = await crearClienteConVehiculo();
    const sin = await crear({ ...cuerpoBase(datos), mechanicId: undefined });
    expect(sin.status).toBe(400);
    expect(sin.body.error.details.map((d) => d.field)).toContain('mechanicId');

    const recepcion = await crear(cuerpoBase(datos, { mechanicId: usuarios.RECEPTIONIST.id }));
    expect(recepcion.status).toBe(400);

    await pool.execute('UPDATE users SET active = 0 WHERE id = ?', [mecanico2.id]);
    const inactivo = await crear(cuerpoBase(datos, { mechanicId: mecanico2.id }));
    expect(inactivo.status).toBe(400);
    await pool.execute('UPDATE users SET active = 1 WHERE id = ?', [mecanico2.id]);
    expect((await crear(cuerpoBase(datos, { mechanicId: mecanico2.id }))).status).toBe(201);

    expect((await crear(cuerpoBase(datos, { mechanicId: 999999 }))).status).toBe(404);
  });

  test('rechaza_un_vehiculo_de_otro_cliente_o_inexistente_y_un_cliente_desactivado', async () => {
    const a = await crearClienteConVehiculo();
    const b = await crearClienteConVehiculo();
    const ajeno = await crear(cuerpoBase({ clientId: a.clientId, vehicleId: b.vehicleId }));
    expect(ajeno.status).toBe(400);
    expect(ajeno.body.error.details[0].field).toBe('vehicleId');

    expect((await crear(cuerpoBase({ clientId: a.clientId, vehicleId: 999999 }))).status).toBe(404);

    await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [a.clientId]);
    expect((await crear(cuerpoBase(a))).status).toBe(400);
  });

  test('crea_la_orden_desde_una_cita_confirmada_y_la_cita_pasa_a_en_proceso', async () => {
    const datos = await crearClienteConVehiculo({ km: 30000 });
    const citaId = await crearCita({ ...datos, createdBy: usuarios.ADMIN.id, status: 'CONFIRMADA', reason: 'Cambio de balatas' });

    const respuesta = await crear({
      clientId: datos.clientId,
      vehicleId: datos.vehicleId,
      mechanicId: usuarios.MECHANIC.id,
      entryMileage: 31000,
      appointmentId: citaId,
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ appointmentId: citaId, reportedProblem: 'Cambio de balatas' });

    const cita = await request(app).get(`/api/appointments/${citaId}`).set(como('ADMIN'));
    expect(cita.body.data.status).toBe('EN_PROCESO');
    expect(cita.body.data.orderId).toBe(respuesta.body.data.id);

    // La cita ya tiene una orden activa: no admite otra.
    const repetida = await crear({
      clientId: datos.clientId,
      vehicleId: datos.vehicleId,
      mechanicId: usuarios.MECHANIC.id,
      entryMileage: 31000,
      appointmentId: citaId,
    });
    expect(repetida.status).toBe(409);
  });

  test('una_cita_que_no_esta_confirmada_no_genera_orden', async () => {
    const datos = await crearClienteConVehiculo();
    const citaId = await crearCita({ ...datos, createdBy: usuarios.ADMIN.id, status: 'PENDIENTE' });
    const respuesta = await crear(cuerpoBase(datos, { appointmentId: citaId }));
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('APPOINTMENT_NOT_EDITABLE');
  });

  test('la_creacion_es_atomica_si_falla_no_queda_nada_a_medias', async () => {
    const datos = await crearClienteConVehiculo({ km: 20000 });
    const [antes] = await pool.query('SELECT COUNT(*) total FROM service_orders');
    const fallida = await crear(cuerpoBase(datos, { mechanicId: 999999 }));
    expect(fallida.status).toBe(404);
    const [despues] = await pool.query('SELECT COUNT(*) total FROM service_orders');
    expect(despues[0].total).toBe(antes[0].total);
    const [vehiculo] = await pool.execute('SELECT currentMileage FROM vehicles WHERE id = ?', [datos.vehicleId]);
    expect(vehiculo[0].currentMileage).toBe(20000);
  });

  test('la_lista_de_mecanicos_activos_es_solo_para_recepcion_y_administracion', async () => {
    const lista = await request(app).get('/api/mechanics').set(como('RECEPTIONIST'));
    expect(lista.status).toBe(200);
    expect(lista.body.data.map((m) => m.name)).toEqual(['Mecánico de prueba', 'Segundo Mecánico de prueba']);
    expect(lista.body.data[0]).toEqual({ id: usuarios.MECHANIC.id, name: 'Mecánico de prueba' });
    expect((await request(app).get('/api/mechanics').set(como('MECHANIC'))).status).toBe(403);
    expect((await request(app).get('/api/mechanics')).status).toBe(401);
  });
});
