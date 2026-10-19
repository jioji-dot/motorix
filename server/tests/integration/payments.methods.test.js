import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const pagar = (orden, cuerpo) => request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send(cuerpo);

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Métodos de pago (integración)', () => {
  test('efectivo_tarjeta_y_transferencia_quedan_PAGADO_con_su_metodo_y_referencia', async () => {
    const orden = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 900 });
    const casos = [
      { method: 'EFECTIVO', amount: 300 },
      { method: 'TARJETA', amount: 300, reference: 'AUT 556677' },
      { method: 'TRANSFERENCIA', amount: 300, reference: 'SPEI 0099887766' },
    ];
    for (const caso of casos) {
      const respuesta = await pagar(orden, caso);
      expect(respuesta.status).toBe(201);
      expect(respuesta.body.data.payment).toMatchObject({ method: caso.method, status: 'PAGADO', reference: caso.reference ?? null });
    }
    const lista = await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'));
    expect(lista.body.data.payments.map((p) => p.method).sort()).toEqual(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']);
  });

  test('un_metodo_invalido_o_ausente_responde_400', async () => {
    const orden = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id });
    expect((await pagar(orden, { method: 'CHEQUE', amount: 10 })).status).toBe(400);
    expect((await pagar(orden, { amount: 10 })).status).toBe(400);
  });

  test('una_referencia_con_forma_de_numero_de_tarjeta_se_rechaza_y_no_se_guarda', async () => {
    const orden = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id });
    const respuesta = await pagar(orden, { method: 'TARJETA', amount: 10, reference: '4111 1111 1111 1111' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].field).toBe('reference');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE reference LIKE ?', ['%4111%']);
    expect(total).toBe(0);
  });

  test('ningun_dato_enviado_como_extra_se_guarda_numero_vencimiento_o_cvv_se_ignoran', async () => {
    const orden = await crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id });
    const respuesta = await pagar(orden, { method: 'TARJETA', amount: 10, cardNumber: '4111111111111111', cvv: '123', expiry: '12/30' });
    expect(respuesta.status).toBe(201);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/4111111111111111|cvv|expiry|cardNumber/);
  });

  test('el_esquema_no_tiene_columnas_de_datos_de_tarjeta_ni_de_credenciales', async () => {
    const [columnas] = await pool.query(
      "SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('payments', 'tickets')",
    );
    expect(columnas.length).toBeGreaterThan(10);
    const prohibidas = /card|tarjeta_|pan\b|cvv|cvc|expir|vencim|secret|token|password|contrase|credential|access/i;
    const encontradas = columnas.filter((c) => prohibidas.test(c.columna));
    expect(encontradas).toEqual([]);
  });
});
