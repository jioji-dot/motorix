import { jest } from '@jest/globals';
import { createDashboardService, periodos, porUrgencia } from '../../services/dashboardService.js';

describe('Periodos del panel (hora local)', () => {
  test('calcula_hoy_manana_el_fin_de_los_proximos_7_dias_y_los_limites_del_mes', () => {
    expect(periodos(new Date(2026, 9, 19, 15, 30))).toEqual({
      today: '2026-10-19',
      tomorrow: '2026-10-20',
      upcomingEnd: '2026-10-27',
      monthStart: '2026-10-01',
      nextMonthStart: '2026-11-01',
    });
  });

  test('en_el_ultimo_minuto_del_dia_sigue_siendo_hoy', () => {
    expect(periodos(new Date(2026, 9, 31, 23, 59, 59))).toMatchObject({ today: '2026-10-31', tomorrow: '2026-11-01', nextMonthStart: '2026-11-01' });
  });

  test('a_las_00_00_ya_es_el_dia_siguiente_y_cambia_de_mes', () => {
    expect(periodos(new Date(2026, 10, 1, 0, 0, 0))).toMatchObject({ today: '2026-11-01', monthStart: '2026-11-01', nextMonthStart: '2026-12-01' });
  });

  test('cruza_el_cambio_de_anio', () => {
    expect(periodos(new Date(2026, 11, 30, 12))).toMatchObject({ tomorrow: '2026-12-31', upcomingEnd: '2027-01-07', nextMonthStart: '2027-01-01' });
  });
});

describe('Orden por urgencia de las refacciones', () => {
  const p = (name, stock, minimumStock) => ({ name, stock, minimumStock });

  test('las_agotadas_van_primero_y_luego_la_menor_proporcion_de_stock', () => {
    const lista = [p('C', 4, 4), p('A', 0, 2), p('B', 1, 4), p('D', 2, 8)].sort(porUrgencia);
    expect(lista.map((x) => x.name)).toEqual(['A', 'B', 'D', 'C']);
  });

  test('en_empate_ordena_por_nombre_y_tolera_minimo_cero', () => {
    const lista = [p('Z', 0, 0), p('M', 0, 0)].sort(porUrgencia);
    expect(lista.map((x) => x.name)).toEqual(['M', 'Z']);
  });
});

function crearServicio() {
  const dashboardModel = {
    ordersByStatus: jest.fn(async () => ({ TERMINADO: 2, ENTREGADO: 1 })),
    ordersWithBalance: jest.fn(async () => ({ count: 1, amount: '2080.5' })),
    appointments: jest.fn(async () => ({ today: 2, upcoming: 3, next: [{ id: 1 }] })),
    collected: jest.fn(async ({ from }) => (from.endsWith('-01') ? '6202.5' : '300')),
  };
  const partModel = {
    summary: jest.fn(async () => ({ total: 14, ok: 11, low: 2, out: 1 })),
    list: jest.fn(async () => ({
      items: Array.from({ length: 7 }, (_, i) => ({
        id: i, code: `C${i}`, name: `P${i}`, stock: i, minimumStock: 10, stockLevel: i === 0 ? 'OUT' : 'LOW', purchasePrice: '9.00',
      })),
    })),
  };
  const maintenanceService = {
    list: jest.fn(async ({ classification }) => ({ meta: { total: classification[0] === 'VENCIDO' ? 4 : 5 } })),
  };
  const servicio = createDashboardService({ dashboardModel, partModel, maintenanceService, ahora: () => new Date(2026, 9, 19, 12) });
  return { servicio, dashboardModel, partModel, maintenanceService };
}

describe('Panel de control: armado de la respuesta', () => {
  test('reune_las_cifras_de_todos_los_modulos', async () => {
    const { servicio } = crearServicio();
    const panel = await servicio.get();
    expect(panel.orders).toEqual({ byStatus: { TERMINADO: 2, ENTREGADO: 1 }, withBalance: { count: 1, amount: '2080.50' } });
    expect(panel.appointments).toEqual({ today: 2, upcoming: 3, next: [{ id: 1 }] });
    expect(panel.maintenance).toEqual({ overdue: 4, soon: 5 });
    expect(panel.inventory).toMatchObject({ low: 2, out: 1 });
    expect(panel.payments).toEqual({ collectedToday: '300.00', collectedMonth: '6202.50', pendingToCollect: '2080.50' });
    expect(typeof panel.generatedAt).toBe('string');
  });

  test('las_refacciones_mas_urgentes_son_cinco_sin_precio_de_compra', async () => {
    const { servicio } = crearServicio();
    const { inventory } = await servicio.get();
    expect(inventory.mostUrgent).toHaveLength(5);
    expect(inventory.mostUrgent[0].stockLevel).toBe('OUT');
    expect(inventory.mostUrgent.map((x) => x.stock)).toEqual([0, 1, 2, 3, 4]);
    expect(JSON.stringify(inventory)).not.toContain('purchasePrice');
  });

  test('reutiliza_los_modulos_de_origen_con_los_periodos_en_hora_local', async () => {
    const { servicio, dashboardModel, maintenanceService, partModel } = crearServicio();
    await servicio.get();
    expect(dashboardModel.appointments).toHaveBeenCalledWith({ today: '2026-10-19', tomorrow: '2026-10-20', limit: '2026-10-27' });
    expect(dashboardModel.collected).toHaveBeenCalledWith({ from: '2026-10-19', to: '2026-10-20' });
    expect(dashboardModel.collected).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-11-01' });
    expect(maintenanceService.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDIENTE', classification: ['VENCIDO'] }));
    expect(maintenanceService.list).toHaveBeenCalledWith(expect.objectContaining({ classification: ['PROXIMO'] }));
    expect(partModel.list).toHaveBeenCalledWith(expect.objectContaining({ stockLevel: ['LOW', 'OUT'], active: 'true' }));
  });

  test('sin_datos_todo_vale_cero_o_lista_vacia', async () => {
    const { servicio, dashboardModel, partModel, maintenanceService } = crearServicio();
    dashboardModel.ordersByStatus.mockResolvedValue({});
    dashboardModel.ordersWithBalance.mockResolvedValue({ count: 0, amount: '0' });
    dashboardModel.appointments.mockResolvedValue({ today: 0, upcoming: 0, next: [] });
    dashboardModel.collected.mockResolvedValue('0');
    partModel.summary.mockResolvedValue({ total: 0, ok: 0, low: 0, out: 0 });
    partModel.list.mockResolvedValue({ items: [] });
    maintenanceService.list.mockResolvedValue({ meta: { total: 0 } });
    const panel = await servicio.get();
    expect(panel.payments).toEqual({ collectedToday: '0.00', collectedMonth: '0.00', pendingToCollect: '0.00' });
    expect(panel.inventory.mostUrgent).toEqual([]);
    expect(panel.maintenance).toEqual({ overdue: 0, soon: 0 });
  });
});
