import { jest } from '@jest/globals';
import { createMaintenanceService } from '../../services/maintenanceService.js';

const m = (id, extra) => ({
  id,
  status: 'PENDIENTE',
  nextDate: null,
  nextMileage: null,
  vehicle: { currentMileage: 50000 },
  client: { id: 1, name: 'Cliente', phone: '5512345678' },
  ...extra,
});

function crearServicio(filas, kilometraje = 50000) {
  const maintenanceModel = {
    listAll: jest.fn(async () => filas.map((f) => ({ ...f, vehicle: { currentMileage: kilometraje } }))),
  };
  return {
    servicio: createMaintenanceService({ maintenanceModel, vehicleModel: {}, hoy: () => '2026-10-19' }),
    maintenanceModel,
  };
}

const CASOS = [
  m(1, { nextDate: '2027-03-01' }), // NORMAL
  m(2, { nextDate: '2026-10-25' }), // PROXIMO
  m(3, { nextDate: '2026-10-01' }), // VENCIDO por fecha
  m(4, { nextMileage: 50300 }), // PROXIMO por km
  m(5, { nextMileage: 49000 }), // VENCIDO por km
  m(6, { nextMileage: 60000 }), // NORMAL
  m(7, { status: 'ATENDIDO', nextDate: '2026-01-01' }),
];

describe('Listado de mantenimientos (servicio)', () => {
  const paginacion = { page: 1, pageSize: 20 };

  test('ordena_vencido_proximo_normal_y_deja_los_atendidos_al_final', async () => {
    const { servicio } = crearServicio(CASOS);
    const { items, meta } = await servicio.list({ status: 'all', ...paginacion });
    expect(items.map((x) => x.id)).toEqual([5, 3, 2, 4, 1, 6, 7]);
    expect(items.map((x) => x.classification)).toEqual(['VENCIDO', 'VENCIDO', 'PROXIMO', 'PROXIMO', 'NORMAL', 'NORMAL', null]);
    expect(meta.total).toBe(7);
  });

  test('filtra_por_una_o_varias_clasificaciones', async () => {
    const { servicio } = crearServicio(CASOS);
    const vencidos = await servicio.list({ status: 'PENDIENTE', classification: ['VENCIDO'], ...paginacion });
    expect(vencidos.items.map((x) => x.id)).toEqual([5, 3]);
    const urgentes = await servicio.list({ status: 'PENDIENTE', classification: ['VENCIDO', 'PROXIMO'], ...paginacion });
    expect(urgentes.items).toHaveLength(4);
  });

  test('pagina_en_memoria_con_el_total_correcto', async () => {
    const { servicio } = crearServicio(CASOS);
    const pagina2 = await servicio.list({ status: 'all', page: 2, pageSize: 3 });
    expect(pagina2.items.map((x) => x.id)).toEqual([4, 1, 6]);
    expect(pagina2.meta).toEqual({ page: 2, pageSize: 3, total: 7 });
    const ultima = await servicio.list({ status: 'all', page: 3, pageSize: 3 });
    expect(ultima.items.map((x) => x.id)).toEqual([7]);
  });

  test('entrega_los_filtros_de_base_de_datos_al_modelo', async () => {
    const { servicio, maintenanceModel } = crearServicio(CASOS);
    await servicio.list({ status: 'PENDIENTE', vehicleId: 4, clientId: 2, search: 'aceite', ...paginacion });
    expect(maintenanceModel.listAll).toHaveBeenCalledWith({ status: 'PENDIENTE', vehicleId: 4, clientId: 2, search: 'aceite' });
  });

  test('se_reclasifica_cuando_cambia_el_kilometraje_actual_del_vehiculo', async () => {
    const solo = [m(1, { nextMileage: 52000 })];
    const antes = await crearServicio(solo, 50000).servicio.list({ status: 'PENDIENTE', page: 1, pageSize: 20 });
    expect(antes.items[0]).toMatchObject({ classification: 'NORMAL', kmLeft: 2000 });
    const despues = await crearServicio(solo, 51800).servicio.list({ status: 'PENDIENTE', page: 1, pageSize: 20 });
    expect(despues.items[0]).toMatchObject({ classification: 'PROXIMO', kmLeft: 200 });
    const vencido = await crearServicio(solo, 52000).servicio.list({ status: 'PENDIENTE', page: 1, pageSize: 20 });
    expect(vencido.items[0].classification).toBe('VENCIDO');
  });

  test('los_atendidos_no_llevan_clasificacion_ni_valores_restantes', async () => {
    const { servicio } = crearServicio([CASOS[6]]);
    const { items } = await servicio.list({ status: 'ATENDIDO', page: 1, pageSize: 20 });
    expect(items[0]).toMatchObject({ classification: null, daysLeft: null, kmLeft: null });
  });
});
