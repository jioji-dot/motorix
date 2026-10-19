import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

async function crearCliente(datos, rol = 'RECEPTIONIST') {
  return request(app).post('/api/clients').set(como(rol)).send(datos);
}

describe('Clientes (integración)', () => {
  test.each(['ADMIN', 'RECEPTIONIST'])('el_rol_%s_puede_crear_y_editar_clientes', async (rol) => {
    const alta = await crearCliente({ name: `Cliente ${rol}`, phone: rol === 'ADMIN' ? '5511000001' : '5511000002' }, rol);
    expect(alta.status).toBe(201);
    expect(alta.body.data).toMatchObject({ name: `Cliente ${rol}`, active: true, email: null });

    const edicion = await request(app)
      .patch(`/api/clients/${alta.body.data.id}`)
      .set(como(rol))
      .send({ email: 'nuevo@taller.mx' });
    expect(edicion.status).toBe(200);
    expect(edicion.body.data.email).toBe('nuevo@taller.mx');
  });

  test('el_mecanico_solo_consulta_y_recibe_403_al_escribir', async () => {
    const lectura = await request(app).get('/api/clients').set(como('MECHANIC'));
    expect(lectura.status).toBe(200);

    const alta = await crearCliente({ name: 'No debe crearse', phone: '5599999999' }, 'MECHANIC');
    expect(alta.status).toBe(403);
    expect(alta.body.error.code).toBe('FORBIDDEN');

    const [filas] = await pool.query("SELECT COUNT(*) total FROM clients WHERE name = 'No debe crearse'");
    expect(filas[0].total).toBe(0);

    const { body } = await request(app).get('/api/clients').set(como('ADMIN'));
    const edicion = await request(app)
      .patch(`/api/clients/${body.data[0].id}`)
      .set(como('MECHANIC'))
      .send({ name: 'Cambio no permitido' });
    expect(edicion.status).toBe(403);
  });

  test('rechaza_peticiones_sin_token', async () => {
    expect((await request(app).get('/api/clients')).status).toBe(401);
    expect((await request(app).post('/api/clients').send({})).status).toBe(401);
  });

  test('busca_por_nombre_telefono_y_correo', async () => {
    await crearCliente({ name: 'Mariana Torres', phone: '5544001122', email: 'mariana@correo.mx' });
    await crearCliente({ name: 'Jorge Ávila', phone: '5544003344', email: 'jorge@otro.mx' });

    const porNombre = await request(app).get('/api/clients?search=mariana').set(como('RECEPTIONIST'));
    expect(porNombre.body.data.map((c) => c.name)).toEqual(['Mariana Torres']);

    const porTelefono = await request(app).get('/api/clients?search=5544003344').set(como('RECEPTIONIST'));
    expect(porTelefono.body.data.map((c) => c.name)).toEqual(['Jorge Ávila']);

    const porCorreo = await request(app).get('/api/clients?search=@correo.mx').set(como('RECEPTIONIST'));
    expect(porCorreo.body.data.map((c) => c.name)).toEqual(['Mariana Torres']);
    expect(porCorreo.body.meta.total).toBe(1);
  });

  test('el_telefono_repetido_avisa_y_se_guarda_solo_al_confirmar', async () => {
    await crearCliente({ name: 'Primero', phone: '5577000001' });

    const aviso = await crearCliente({ name: 'Segundo', phone: '55 7700-0001' });
    expect(aviso.status).toBe(409);
    expect(aviso.body.error.code).toBe('DUPLICATE_PHONE');
    expect(aviso.body.error.details[0]).toMatchObject({ name: 'Primero', phone: '5577000001' });

    const confirmado = await crearCliente({ name: 'Segundo', phone: '5577000001', confirmDuplicatePhone: true });
    expect(confirmado.status).toBe(201);
  });

  test('el_detalle_incluye_los_vehiculos_asociados', async () => {
    const alta = await crearCliente({ name: 'Con vehículos', phone: '5588000001' });
    const id = alta.body.data.id;
    await pool.execute(
      "INSERT INTO vehicles (clientId, brand, model, year, licensePlate, currentMileage) VALUES (?, 'Nissan', 'Versa', 2020, 'DET-001-A', 45000)",
      [id],
    );

    const detalle = await request(app).get(`/api/clients/${id}`).set(como('MECHANIC'));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data.name).toBe('Con vehículos');
    expect(detalle.body.data.vehicles).toHaveLength(1);
    expect(detalle.body.data.vehicles[0]).toMatchObject({ brand: 'Nissan', licensePlate: 'DET-001-A' });
  });

  test('desactivar_un_cliente_conserva_su_informacion_y_sus_vehiculos', async () => {
    const alta = await crearCliente({ name: 'Se desactiva', phone: '5599000001' });
    const id = alta.body.data.id;
    await pool.execute(
      "INSERT INTO vehicles (clientId, brand, model, year, licensePlate, currentMileage) VALUES (?, 'VW', 'Jetta', 2018, 'DES-001-A', 80000)",
      [id],
    );

    const baja = await request(app).patch(`/api/clients/${id}`).set(como('RECEPTIONIST')).send({ active: false });
    expect(baja.status).toBe(200);
    expect(baja.body.data.active).toBe(false);

    const detalle = await request(app).get(`/api/clients/${id}`).set(como('RECEPTIONIST'));
    expect(detalle.body.data.name).toBe('Se desactiva');
    expect(detalle.body.data.vehicles).toHaveLength(1);

    const inactivos = await request(app).get('/api/clients?active=false').set(como('RECEPTIONIST'));
    expect(inactivos.body.data.map((c) => c.id)).toContain(id);
  });

  test('devuelve_404_para_un_cliente_inexistente_y_400_para_un_id_invalido', async () => {
    expect((await request(app).get('/api/clients/999999').set(como('ADMIN'))).status).toBe(404);
    expect((await request(app).get('/api/clients/abc').set(como('ADMIN'))).status).toBe(400);
  });
});
