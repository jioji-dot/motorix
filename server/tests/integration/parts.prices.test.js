import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let contador = 0;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nueva = (extra = {}) => {
  contador += 1;
  return {
    code: `PRC-${String(contador).padStart(3, '0')}`,
    name: `Refacción con precios ${contador}`,
    category: 'Frenos',
    brand: 'Brembo',
    minimumStock: 2,
    purchasePrice: 100,
    salePrice: 150,
    ...extra,
  };
};
const crear = (cuerpo, rol = 'ADMIN') => request(app).post('/api/parts').set(como(rol)).send(cuerpo);
const editar = (id, cuerpo, rol = 'ADMIN') => request(app).patch(`/api/parts/${id}`).set(como(rol)).send(cuerpo);
const detalle = (id) => request(app).get(`/api/parts/${id}`).set(como('ADMIN'));

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('Precios de las refacciones (integración, Sprint 5)', () => {
  test('el_administrador_crea_y_edita_una_refaccion_y_los_cuatro_datos_persisten', async () => {
    const creada = await crear(nueva({ category: 'Frenos', brand: 'Brembo', purchasePrice: 100, salePrice: 150 }));
    expect(creada.status).toBe(201);
    const id = creada.body.data.id;
    expect((await detalle(id)).body.data).toMatchObject({ category: 'Frenos', brand: 'Brembo', purchasePrice: '100.00', salePrice: '150.00' });

    const editada = await editar(id, { category: 'Suspensión', brand: 'Monroe', purchasePrice: 110.5, salePrice: 199.99 });
    expect(editada.status).toBe(200);
    expect((await detalle(id)).body.data).toMatchObject({ category: 'Suspensión', brand: 'Monroe', purchasePrice: '110.50', salePrice: '199.99' });
  });

  test('los_precios_invalidos_responden_400_con_el_campo_que_falla_y_no_guardan_nada', async () => {
    for (const [campo, valor] of [
      ['salePrice', -1],
      ['salePrice', 'abc'],
      ['salePrice', 12.345],
      ['salePrice', 100000000],
      ['purchasePrice', -0.01],
      ['purchasePrice', 'x'],
      ['purchasePrice', 99.999],
    ]) {
      const respuesta = await crear(nueva({ [campo]: valor }));
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
      expect(respuesta.body.error.details.map((d) => d.field)).toContain(campo);
    }
    const { id } = await crearRefaccion({ purchasePrice: 10, salePrice: 20 });
    const mala = await editar(id, { salePrice: -5 });
    expect(mala.status).toBe(400);
    expect((await detalle(id)).body.data.salePrice).toBe('20.00');
  });

  test('el_precio_maximo_99999999_99_se_acepta', async () => {
    const respuesta = await crear(nueva({ purchasePrice: 99999999.99, salePrice: 99999999.99 }));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.salePrice).toBe('99999999.99');
  });

  test('venta_menor_al_costo_sin_confirmar_responde_409_PRICE_BELOW_COST_y_no_guarda', async () => {
    const cuerpo = nueva({ purchasePrice: 100, salePrice: 80 });
    const respuesta = await crear(cuerpo);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({ code: 'PRICE_BELOW_COST', details: [{ field: 'salePrice' }] });
    const lista = await request(app).get(`/api/parts?search=${cuerpo.code}`).set(como('ADMIN'));
    expect(lista.body.data).toHaveLength(0);
  });

  test('con_confirmBelowCost_true_se_guarda_la_venta_menor_al_costo_y_la_confirmacion_no_se_almacena', async () => {
    const respuesta = await crear(nueva({ purchasePrice: 100, salePrice: 80, confirmBelowCost: true }));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ purchasePrice: '100.00', salePrice: '80.00' });
    expect(respuesta.body.data).not.toHaveProperty('confirmBelowCost');
  });

  test('editar_los_precios_por_debajo_del_costo_pide_confirmacion_y_editar_otros_datos_no', async () => {
    const { id } = await crearRefaccion({ purchasePrice: 100, salePrice: 150 });
    const sin = await editar(id, { salePrice: 90 });
    expect(sin.status).toBe(409);
    expect(sin.body.error.code).toBe('PRICE_BELOW_COST');
    expect((await detalle(id)).body.data.salePrice).toBe('150.00');

    const con = await editar(id, { salePrice: 90, confirmBelowCost: true });
    expect(con.status).toBe(200);
    expect(con.body.data.salePrice).toBe('90.00');

    // La venta ya es menor al costo: cambiar solo el nombre no pide confirmar de nuevo.
    const nombre = await editar(id, { name: 'Otro nombre' });
    expect(nombre.status).toBe(200);
    expect(nombre.body.data).toMatchObject({ name: 'Otro nombre', salePrice: '90.00' });
  });

  test('subir_la_compra_por_encima_de_la_venta_tambien_pide_confirmacion', async () => {
    const { id } = await crearRefaccion({ purchasePrice: 100, salePrice: 150 });
    const respuesta = await editar(id, { purchasePrice: 200 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('PRICE_BELOW_COST');
  });

  test('un_precio_de_venta_0_se_permite_para_piezas_sin_cargo', async () => {
    const respuesta = await crear(nueva({ purchasePrice: 0, salePrice: 0 }));
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.salePrice).toBe('0.00');
    const conCosto = await crear(nueva({ purchasePrice: 30, salePrice: 0, confirmBelowCost: true }));
    expect(conCosto.status).toBe(201);
  });

  test('solo_el_administrador_crea_o_cambia_precios_y_los_demas_roles_reciben_403', async () => {
    const { id } = await crearRefaccion();
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      expect((await crear(nueva(), rol)).status).toBe(403);
      expect((await editar(id, { salePrice: 999 }, rol)).status).toBe(403);
    }
    expect((await detalle(id)).body.data.salePrice).toBe('120.00');
  });
});
