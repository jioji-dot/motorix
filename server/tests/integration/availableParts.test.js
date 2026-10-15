// Pruebas de integración de la búsqueda de refacciones disponibles para las órdenes (US7).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createPart } from '../helpers/factories.js';

const app = createApp();

const buscar = (auth, consulta) =>
  request(app).get(`/api/parts/available${consulta}`).set('Authorization', auth);

let mecanico;

beforeEach(async () => {
  await cleanTables();
  mecanico = await createAuthenticated('MECHANIC');
});
afterAll(closePool);

describe('refacciones disponibles', () => {
  test('test_exige_un_texto_de_busqueda_de_al_menos_dos_caracteres', async () => {
    const sinTexto = await buscar(mecanico.auth, '');
    const corto = await buscar(mecanico.auth, '?search=a');

    expect(sinTexto.status).toBe(400);
    expect(corto.status).toBe(400);
    expect(corto.body.error.details.map((d) => d.field)).toContain('search');
  });

  test('test_solo_devuelve_refacciones_activas_con_existencia', async () => {
    await createPart({ code: 'FIL-01', name: 'Filtro de aceite', stock: 4 });
    await createPart({ code: 'FIL-02', name: 'Filtro agotado', stock: 0 });
    await createPart({ code: 'FIL-03', name: 'Filtro inactivo', stock: 5, active: 0 });

    const res = await buscar(mecanico.auth, '?search=filtro');

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.code)).toEqual(['FIL-01']);
  });

  test('test_busca_por_codigo_o_nombre_y_ordena_por_nombre', async () => {
    await createPart({ code: 'ZZZ-1', name: 'Balata trasera', stock: 3 });
    await createPart({ code: 'BAL-9', name: 'Zapata', stock: 3 });
    await createPart({ code: 'OTR-1', name: 'Otra pieza', stock: 3 });

    const res = await buscar(mecanico.auth, '?search=bal');

    expect(res.body.data.map((p) => p.name)).toEqual(['Balata trasera', 'Zapata']);
  });

  test('test_solo_devuelve_los_campos_publicos_y_respeta_el_limite', async () => {
    for (let i = 1; i <= 5; i += 1) await createPart({ code: `FIL-0${i}`, name: `Filtro ${i}`, stock: 2 });

    const res = await buscar(mecanico.auth, '?search=filtro&limit=3');

    expect(res.body.data).toHaveLength(3);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['code', 'id', 'name', 'price', 'stock']);
  });

  test('test_el_limite_fuera_de_rango_se_rechaza', async () => {
    const res = await buscar(mecanico.auth, '?search=filtro&limit=500');

    expect(res.status).toBe(400);
  });

  test('test_administrador_y_mecanico_pueden_buscar_pero_recepcion_recibe_403', async () => {
    await createPart({ name: 'Filtro', stock: 2 });
    const admin = await createAuthenticated('ADMIN');
    const recepcion = await createAuthenticated('RECEPTIONIST');

    expect((await buscar(admin.auth, '?search=filtro')).status).toBe(200);
    expect((await buscar(mecanico.auth, '?search=filtro')).status).toBe(200);
    expect((await buscar(recepcion.auth, '?search=filtro')).status).toBe(403);
  });

  test('test_la_ruta_available_no_se_confunde_con_el_detalle_de_una_refaccion', async () => {
    const res = await buscar(mecanico.auth, '?search=zz');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
