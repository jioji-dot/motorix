// Los márgenes de «Próximo» salen de la configuración y los respetan Mantenimientos, el panel y los avisos (Sprint 7, FR-003, FR-004).
import request from 'supertest';
import { app } from '../../app.js';
import { classify } from '../../services/maintenanceClassifier.js';
import { cerrarConexiones, crearClienteConVehiculo, crearMantenimiento, crearUsuariosDePrueba, fechaDia, limpiarBase } from '../helpers.js';

let usuarios;
let veinticinco;
let porKm;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const { vehicleId } = await crearClienteConVehiculo({ km: 40000 });
  veinticinco = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'A 25 días', nextDate: fechaDia(25) });
  porKm = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'A 900 km', nextMileage: 40900 });
});
afterAll(cerrarConexiones);

const auth = { get: (u) => ({ Authorization: `Bearer ${u.token}` }) };
const clase = async (id) => (await request(app).get(`/api/maintenance/${id}`).set(auth.get(usuarios.ADMIN))).body.data.classification;
const configurar = (maintenance) => request(app).put('/api/settings').set(auth.get(usuarios.ADMIN)).send({ maintenance });

describe('classify con márgenes explícitos', () => {
  test('con_los_margenes_de_hoy_el_comportamiento_no_cambia', () => {
    expect(classify({ nextDate: fechaDia(15) }, 0).classification).toBe('PROXIMO');
    expect(classify({ nextDate: fechaDia(16) }, 0).classification).toBe('NORMAL');
    expect(classify({ nextMileage: 1500 }, 1000).classification).toBe('PROXIMO');
    expect(classify({ nextMileage: 1501 }, 1000).classification).toBe('NORMAL');
  });

  test('usa_los_margenes_indicados_con_limites_inclusivos', () => {
    const m = { dias: 30, km: 1000 };
    expect(classify({ nextDate: fechaDia(30) }, 0, undefined, m).classification).toBe('PROXIMO');
    expect(classify({ nextDate: fechaDia(31) }, 0, undefined, m).classification).toBe('NORMAL');
    expect(classify({ nextMileage: 2000 }, 1000, undefined, m).classification).toBe('PROXIMO');
    expect(classify({ nextMileage: 2001 }, 1000, undefined, m).classification).toBe('NORMAL');
    expect(classify({ nextDate: fechaDia(-1) }, 0, undefined, m).classification).toBe('VENCIDO');
  });
});

describe('márgenes configurables', () => {
  test('por_omision_un_mantenimiento_a_25_dias_o_900_km_es_normal', async () => {
    expect(await clase(veinticinco)).toBe('NORMAL');
    expect(await clase(porKm)).toBe('NORMAL');
  });

  test('al_guardar_30_dias_y_1000_km_pasan_a_proximo_en_mantenimientos_panel_y_avisos', async () => {
    expect((await configurar({ warnDays: 30, warnKm: 1000 })).status).toBe(200);
    expect(await clase(veinticinco)).toBe('PROXIMO');
    expect(await clase(porKm)).toBe('PROXIMO');

    const lista = await request(app).get('/api/maintenance?status=PENDIENTE&classification=PROXIMO').set(auth.get(usuarios.ADMIN));
    expect(lista.body.meta.total).toBe(2);
    const panel = await request(app).get('/api/dashboard').set(auth.get(usuarios.ADMIN));
    expect(panel.body.data.maintenance.soon).toBe(2);
    const avisos = await request(app).get('/api/notifications').set(auth.get(usuarios.ADMIN));
    expect(avisos.body.data.groups.find((g) => g.type === 'MAINTENANCE_SOON').total).toBe(2);
  });

  test('volver_a_los_valores_anteriores_los_regresa_a_normal', async () => {
    await configurar({ warnDays: 15, warnKm: 500 });
    expect(await clase(veinticinco)).toBe('NORMAL');
  });

  test('valores_fuera_de_limite_responden_400_y_no_cambian_nada', async () => {
    for (const cuerpo of [{ warnDays: 0 }, { warnDays: 400 }, { warnKm: 0 }, { warnKm: 100001 }]) {
      expect((await configurar(cuerpo)).status).toBe(400);
    }
    expect(await clase(veinticinco)).toBe('NORMAL');
  });

  test('los_limites_1_y_365_y_1_y_100000_se_aceptan', async () => {
    expect((await configurar({ warnDays: 1, warnKm: 1 })).status).toBe(200);
    expect((await configurar({ warnDays: 365, warnKm: 100000 })).status).toBe(200);
    await configurar({ warnDays: 15, warnKm: 500 });
  });
});
