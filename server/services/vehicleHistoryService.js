// Historial de servicios de un vehículo: vista calculada, sin tabla propia (aclaración del Sprint 3).
import * as modeloHistorial from '../models/historyModel.js';
import * as modeloVehiculos from '../models/vehicleModel.js';
import { HttpError } from '../utils/httpError.js';

function agruparPorOrden(filas) {
  const mapa = new Map();
  for (const { orderId, ...linea } of filas) {
    if (!mapa.has(orderId)) mapa.set(orderId, []);
    mapa.get(orderId).push(linea);
  }
  return mapa;
}

export function createVehicleHistoryService({ historyModel = modeloHistorial, vehicleModel = modeloVehiculos } = {}) {
  async function list(vehicleId, { page, pageSize }) {
    const vehiculo = await vehicleModel.findById(vehicleId);
    if (!vehiculo) throw HttpError.notFound('No se encontró el vehículo solicitado.');

    const { filas, total } = await historyModel.listOrders(vehicleId, { page, pageSize });
    const ids = filas.map((fila) => fila.id);
    const [servicios, manoDeObra, refacciones] = await Promise.all([
      historyModel.servicesOf(ids),
      historyModel.laborOf(ids),
      historyModel.partsOf(ids),
    ]);
    const porServicio = agruparPorOrden(servicios);
    const porManoDeObra = agruparPorOrden(manoDeObra);
    const porRefaccion = agruparPorOrden(refacciones);

    const items = filas.map((fila) => ({
      orderId: fila.id,
      folio: fila.folio,
      status: fila.status,
      serviceDate: fila.serviceDate,
      mileage: fila.mileage,
      mechanic: { id: fila.mechanicId, name: fila.mechanicName },
      diagnosis: fila.diagnosis,
      notes: fila.notes,
      recommendations: fila.recommendations,
      total: fila.total,
      services: porServicio.get(fila.id) ?? [],
      labor: porManoDeObra.get(fila.id) ?? [],
      parts: porRefaccion.get(fila.id) ?? [],
    }));
    return { items, meta: { page, pageSize, total } };
  }

  return { list };
}

export const vehicleHistoryService = createVehicleHistoryService();
