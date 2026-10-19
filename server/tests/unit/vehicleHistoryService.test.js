import { jest } from '@jest/globals';
import { createVehicleHistoryService } from '../../services/vehicleHistoryService.js';

function crearEntorno({ vehiculo = { id: 5 }, filas = [], total = filas.length } = {}) {
  const historyModel = {
    listOrders: jest.fn(async () => ({ filas, total })),
    servicesOf: jest.fn(async () => [{ orderId: 1, id: 10, description: 'Aceite', amount: '450.00' }]),
    laborOf: jest.fn(async () => [
      { orderId: 2, id: 20, description: 'Mano de obra', hours: '1.00', hourlyRate: '300.00', amount: '300.00' },
    ]),
    partsOf: jest.fn(async () => [
      { orderId: 1, id: 30, partId: 7, code: 'R-1', name: 'Filtro', quantity: 1, unitPrice: '100.00', amount: '100.00' },
    ]),
  };
  const vehicleModel = { findById: jest.fn(async () => vehiculo) };
  return { servicio: createVehicleHistoryService({ historyModel, vehicleModel }), historyModel, vehicleModel };
}

const fila = (id) => ({
  id,
  folio: `OS-00000${id}`,
  status: 'TERMINADO',
  serviceDate: '2026-10-01',
  mileage: 50000,
  mechanicId: 3,
  mechanicName: 'Mario',
  diagnosis: 'd',
  notes: null,
  recommendations: null,
  total: '550.00',
});

describe('Historial del vehículo (servicio)', () => {
  test('rechaza_con_404_un_vehiculo_inexistente', async () => {
    const { servicio } = crearEntorno({ vehiculo: null });
    await expect(servicio.list(99, { page: 1, pageSize: 20 })).rejects.toMatchObject({ status: 404 });
  });

  test('agrupa_servicios_mano_de_obra_y_refacciones_por_orden', async () => {
    const { servicio } = crearEntorno({ filas: [fila(1), fila(2)] });
    const { items, meta } = await servicio.list(5, { page: 1, pageSize: 20 });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ orderId: 1, mileage: 50000, mechanic: { id: 3, name: 'Mario' } });
    expect(items[0].services).toHaveLength(1);
    expect(items[0].parts).toHaveLength(1);
    expect(items[0].labor).toEqual([]);
    expect(items[1].labor).toHaveLength(1);
    expect(items[1].services).toEqual([]);
    expect(meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  test('carga_las_lineas_por_lotes_con_una_consulta_por_tipo', async () => {
    const { servicio, historyModel } = crearEntorno({ filas: [fila(1), fila(2), fila(3)] });
    await servicio.list(5, { page: 1, pageSize: 20 });
    expect(historyModel.servicesOf).toHaveBeenCalledTimes(1);
    expect(historyModel.laborOf).toHaveBeenCalledTimes(1);
    expect(historyModel.partsOf).toHaveBeenCalledTimes(1);
    expect(historyModel.servicesOf).toHaveBeenCalledWith([1, 2, 3]);
  });

  test('sin_ordenes_devuelve_lista_vacia', async () => {
    const { servicio } = crearEntorno({ filas: [] });
    const { items, meta } = await servicio.list(5, { page: 1, pageSize: 20 });
    expect(items).toEqual([]);
    expect(meta.total).toBe(0);
  });
});
