import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let cliente;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

const VEHICULO = {
  brand: 'Nissan',
  model: 'Versa',
  year: 2020,
  licensePlate: 'abc-123-a',
  vin: '3N1CN7AP5KL123456',
  currentMileage: 45000,
};

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const alta = await request(app)
    .post('/api/clients')
    .set(como('RECEPTIONIST'))
    .send({ name: 'Propietaria de Prueba', phone: '5500112233' });
  cliente = alta.body.data;
});

afterAll(cerrarConexiones);

const crear = (datos, rol = 'RECEPTIONIST') =>
  request(app).post('/api/vehicles').set(como(rol)).send(datos);

describe('Vehículos (integración)', () => {
  test('registra_un_vehiculo_asociado_a_su_propietario_y_lo_ve_el_detalle_del_cliente', async () => {
    const alta = await crear({ ...VEHICULO, clientId: cliente.id });
    expect(alta.status).toBe(201);
    expect(alta.body.data).toMatchObject({
      clientId: cliente.id,
      licensePlate: 'ABC-123-A',
      vin: '3N1CN7AP5KL123456',
      client: { id: cliente.id, name: 'Propietaria de Prueba' },
    });

    const detalleCliente = await request(app).get(`/api/clients/${cliente.id}`).set(como('MECHANIC'));
    expect(detalleCliente.body.data.vehicles.map((v) => v.licensePlate)).toEqual(['ABC-123-A']);
  });

  test('rechaza_un_vehiculo_sin_propietario', async () => {
    const respuesta = await crear({ ...VEHICULO, licensePlate: 'SIN-001' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details).toEqual(
      expect.arrayContaining([{ field: 'clientId', message: 'El propietario es obligatorio.' }]),
    );
    const [filas] = await pool.query("SELECT COUNT(*) total FROM vehicles WHERE licensePlate = 'SIN-001'");
    expect(filas[0].total).toBe(0);
  });

  test('responde_404_si_el_propietario_no_existe', async () => {
    const respuesta = await crear({ ...VEHICULO, clientId: 999999, licensePlate: 'NOE-001', vin: null });
    expect(respuesta.status).toBe(404);
  });

  test('rechaza_placas_duplicadas_con_409', async () => {
    const respuesta = await crear({ ...VEHICULO, clientId: cliente.id, vin: null, licensePlate: ' abc-123-a ' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('DUPLICATE_VALUE');
  });

  test('rechaza_un_vin_duplicado_y_permite_varios_vehiculos_sin_vin', async () => {
    const duplicado = await crear({ ...VEHICULO, clientId: cliente.id, licensePlate: 'DUP-VIN-1' });
    expect(duplicado.status).toBe(409);

    const sinVin1 = await crear({ ...VEHICULO, clientId: cliente.id, licensePlate: 'SIN-VIN-1', vin: null });
    const sinVin2 = await crear({ ...VEHICULO, clientId: cliente.id, licensePlate: 'SIN-VIN-2', vin: '' });
    expect(sinVin1.status).toBe(201);
    expect(sinVin2.status).toBe(201);
  });

  test('el_mecanico_solo_consulta_y_recibe_403_al_escribir', async () => {
    const lectura = await request(app).get('/api/vehicles').set(como('MECHANIC'));
    expect(lectura.status).toBe(200);

    const alta = await crear({ ...VEHICULO, clientId: cliente.id, licensePlate: 'MEC-001', vin: null }, 'MECHANIC');
    expect(alta.status).toBe(403);

    const id = lectura.body.data[0].id;
    const edicion = await request(app).patch(`/api/vehicles/${id}`).set(como('MECHANIC')).send({ brand: 'Otra' });
    expect(edicion.status).toBe(403);
  });

  test('busca_por_placas_marca_modelo_y_propietario', async () => {
    await request(app).post('/api/clients').set(como('ADMIN')).send({ name: 'Otro Dueño', phone: '5500998877' });
    const otro = (await request(app).get('/api/clients?search=Otro').set(como('ADMIN'))).body.data[0];
    await crear({ clientId: otro.id, brand: 'Toyota', model: 'Corolla', year: 2019, licensePlate: 'TOY-777', currentMileage: 1000 });

    const porPlaca = await request(app).get('/api/vehicles?search=TOY-777').set(como('ADMIN'));
    expect(porPlaca.body.data.map((v) => v.licensePlate)).toEqual(['TOY-777']);

    const porMarca = await request(app).get('/api/vehicles?search=nissan').set(como('ADMIN'));
    expect(porMarca.body.data.every((v) => v.brand === 'Nissan')).toBe(true);

    const porPropietario = await request(app).get('/api/vehicles?search=Otro Due').set(como('ADMIN'));
    expect(porPropietario.body.data.map((v) => v.licensePlate)).toEqual(['TOY-777']);

    const porCliente = await request(app).get(`/api/vehicles?clientId=${otro.id}`).set(como('ADMIN'));
    expect(porCliente.body.meta.total).toBe(1);
  });

  test('el_detalle_incluye_al_propietario', async () => {
    const lista = await request(app).get('/api/vehicles?search=ABC-123').set(como('MECHANIC'));
    const detalle = await request(app).get(`/api/vehicles/${lista.body.data[0].id}`).set(como('MECHANIC'));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data.client).toEqual({ id: cliente.id, name: 'Propietaria de Prueba', phone: '5500112233' });
  });

  test('no_deja_bajar_el_kilometraje_sin_correccion_explicita', async () => {
    const lista = await request(app).get('/api/vehicles?search=ABC-123').set(como('ADMIN'));
    const id = lista.body.data[0].id;

    const baja = await request(app).patch(`/api/vehicles/${id}`).set(como('RECEPTIONIST')).send({ currentMileage: 1000 });
    expect(baja.status).toBe(409);
    expect(baja.body.error.code).toBe('MILEAGE_DECREASE');

    const sube = await request(app).patch(`/api/vehicles/${id}`).set(como('RECEPTIONIST')).send({ currentMileage: 46000 });
    expect(sube.status).toBe(200);
    expect(sube.body.data.currentMileage).toBe(46000);

    const correccion = await request(app)
      .patch(`/api/vehicles/${id}`)
      .set(como('RECEPTIONIST'))
      .send({ currentMileage: 44000, mileageCorrection: true });
    expect(correccion.status).toBe(200);
    expect(correccion.body.data.currentMileage).toBe(44000);
  });

  test('la_base_impide_vehiculos_sin_propietario_valido_por_llave_foranea', async () => {
    await expect(
      pool.execute(
        "INSERT INTO vehicles (clientId, brand, model, year, licensePlate, currentMileage) VALUES (424242, 'X', 'Y', 2020, 'FK-001', 0)",
      ),
    ).rejects.toMatchObject({ code: 'ER_NO_REFERENCED_ROW_2' });
  });

  test('rechaza_peticiones_sin_token', async () => {
    expect((await request(app).get('/api/vehicles')).status).toBe(401);
  });
});
