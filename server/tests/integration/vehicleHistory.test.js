import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const base = () => ({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id });
const nueva = (status, extra = {}) => crearOrden({ ...datos, ...base(), status, ...extra });

// Fija la fecha del cambio a TERMINADO: actualiza el registro si crearOrden ya lo creó y, si no, lo inserta.
async function cambioDeEstado(id, from, to, cuando) {
  const [r] = await pool.execute('UPDATE order_status_history SET changedAt = ? WHERE orderId = ? AND toStatus = ?', [cuando, id, to]);
  if (r.affectedRows === 0) {
    await pool.execute(
      'INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy, changedAt) VALUES (?, ?, ?, ?, ?)',
      [id, from, to, usuarios.MECHANIC.id, cuando],
    );
  }
}

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Historial del vehículo (integración)', () => {
  test('solo_aparecen_las_terminadas_y_entregadas_de_la_mas_reciente_a_la_mas_antigua', async () => {
    const vieja = await nueva('ENTREGADO');
    await cambioDeEstado(vieja, 'EN_REPARACION', 'TERMINADO', '2026-01-10 10:00:00');
    const reciente = await nueva('TERMINADO');
    await cambioDeEstado(reciente, 'EN_REPARACION', 'TERMINADO', '2026-03-10 10:00:00');
    await nueva('EN_REPARACION');
    await nueva('CANCELADA');
    await nueva('RECIBIDO');

    for (const rol of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const respuesta = await request(app).get(`/api/vehicles/${datos.vehicleId}/history`).set(como(rol));
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data.map((e) => e.orderId)).toEqual([reciente, vieja]);
      expect(respuesta.body.meta.total).toBe(2);
    }
  });

  test('el_kilometraje_es_el_del_servicio_o_el_de_entrada_si_falta', async () => {
    const otro = await crearClienteConVehiculo({ km: 10000 });
    const con = await crearOrden({ ...otro, ...base(), status: 'TERMINADO', entryMileage: 10000 });
    await cambioDeEstado(con, 'EN_REPARACION', 'TERMINADO', '2026-02-01 10:00:00');
    await pool.execute('UPDATE service_orders SET serviceMileage = 10250 WHERE id = ?', [con]);
    const sin = await crearOrden({ ...otro, ...base(), status: 'TERMINADO', entryMileage: 9000 });
    await cambioDeEstado(sin, 'EN_REPARACION', 'TERMINADO', '2026-01-01 10:00:00');
    const respuesta = await request(app).get(`/api/vehicles/${otro.vehicleId}/history`).set(como('ADMIN'));
    expect(respuesta.body.data.map((e) => e.mileage)).toEqual([10250, 9000]);
  });

  test('una_correccion_a_la_orden_se_refleja_en_el_historial', async () => {
    const otro = await crearClienteConVehiculo();
    const id = await crearOrden({ ...otro, ...base(), status: 'EN_REPARACION' });
    await request(app).post(`/api/orders/${id}/services`).set(como('MECHANIC')).send({ description: 'Afinación', amount: 800 });
    await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({ diagnosis: 'Bujías gastadas' });
    await request(app).post(`/api/orders/${id}/status`).set(como('MECHANIC')).send({ status: 'TERMINADO' });
    const antes = await request(app).get(`/api/vehicles/${otro.vehicleId}/history`).set(como('ADMIN'));
    expect(antes.body.data[0].services).toHaveLength(1);
    expect(antes.body.data[0].diagnosis).toBe('Bujías gastadas');
    await pool.execute('UPDATE order_services SET description = ? WHERE orderId = ?', ['Afinación mayor', id]);
    const despues = await request(app).get(`/api/vehicles/${otro.vehicleId}/history`).set(como('ADMIN'));
    expect(despues.body.data[0].services[0].description).toBe('Afinación mayor');
  });

  test('el_kilometraje_del_servicio_sube_el_del_vehiculo_y_uno_menor_a_la_entrada_se_rechaza', async () => {
    const otro = await crearClienteConVehiculo({ km: 40000 });
    const id = await crearOrden({ ...otro, ...base(), status: 'DIAGNOSTICO', entryMileage: 40000 });
    const mal = await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({ serviceMileage: 39000 });
    expect(mal.status).toBe(400);
    const ok = await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({ serviceMileage: 40420 });
    expect(ok.status).toBe(200);
    const vehiculo = await request(app).get(`/api/vehicles/${otro.vehicleId}`).set(como('ADMIN'));
    expect(vehiculo.body.data.currentMileage).toBe(40420);
    // Un valor posterior menor (pero válido respecto a la entrada) no baja el kilometraje del vehículo.
    await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({ serviceMileage: 40100 });
    const final = await request(app).get(`/api/vehicles/${otro.vehicleId}`).set(como('ADMIN'));
    expect(final.body.data.currentMileage).toBe(40420);
  });

  test('un_vehiculo_sin_servicios_terminados_devuelve_lista_vacia', async () => {
    const otro = await crearClienteConVehiculo();
    const respuesta = await request(app).get(`/api/vehicles/${otro.vehicleId}/history`).set(como('RECEPTIONIST'));
    expect(respuesta.body).toMatchObject({ data: [], meta: { total: 0 } });
  });
});
