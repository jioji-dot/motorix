// Panel de control: cifras calculadas al abrirlo. Reutiliza los módulos de origen para no duplicar sus reglas,
// de modo que cada cifra coincide con la de su pantalla.
import * as modeloPanel from '../models/dashboardModel.js';
import * as modeloRefacciones from '../models/partModel.js';
import { maintenanceService as servicioMantenimientos } from './maintenanceService.js';
import { hoyLocal } from './maintenanceClassifier.js';
import { deCentavos, aCentavos } from '../utils/money.js';

const dos = (n) => String(n).padStart(2, '0');
const aTexto = (f) => `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;

// Fechas de referencia en hora local: hoy, mañana, fin de los próximos 7 días y límites del mes en curso.
export function periodos(ahora = new Date()) {
  const sumarDias = (dias) => aTexto(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias));
  return {
    today: hoyLocal(ahora),
    tomorrow: sumarDias(1),
    upcomingEnd: sumarDias(8), // hoy + 7 días completos
    monthStart: aTexto(new Date(ahora.getFullYear(), ahora.getMonth(), 1)),
    nextMonthStart: aTexto(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)),
  };
}

// Más urgentes primero: agotadas y, entre las de stock bajo, la menor proporción stock/mínimo.
export function porUrgencia(a, b) {
  const proporcion = (p) => (p.stock === 0 ? -1 : p.stock / Math.max(p.minimumStock, 1));
  return proporcion(a) - proporcion(b) || a.name.localeCompare(b.name);
}

export function createDashboardService({
  dashboardModel = modeloPanel,
  partModel = modeloRefacciones,
  maintenanceService = servicioMantenimientos,
  ahora = () => new Date(),
} = {}) {
  async function get() {
    const momento = ahora();
    const fechas = periodos(momento);
    const clase = (classification) =>
      maintenanceService.list({ status: 'PENDIENTE', classification, page: 1, pageSize: 1 }).then((r) => r.meta.total);

    const [byStatus, withBalance, citas, vencidos, proximos, resumenStock, alertas, hoy, mes] = await Promise.all([
      dashboardModel.ordersByStatus(),
      dashboardModel.ordersWithBalance(),
      dashboardModel.appointments({ today: fechas.today, tomorrow: fechas.tomorrow, limit: fechas.upcomingEnd }),
      clase(['VENCIDO']),
      clase(['PROXIMO']),
      partModel.summary(),
      partModel.list({ stockLevel: ['LOW', 'OUT'], active: 'true', page: 1, pageSize: 100 }),
      dashboardModel.collected({ from: fechas.today, to: fechas.tomorrow }),
      dashboardModel.collected({ from: fechas.monthStart, to: fechas.nextMonthStart }),
    ]);

    return {
      generatedAt: momento.toISOString(),
      orders: {
        byStatus,
        withBalance: { count: withBalance.count, amount: deCentavos(aCentavos(withBalance.amount)) },
      },
      appointments: citas,
      maintenance: { overdue: vencidos, soon: proximos },
      inventory: {
        low: resumenStock.low,
        out: resumenStock.out,
        mostUrgent: alertas.items
          .sort(porUrgencia)
          .slice(0, 5)
          .map(({ id, code, name, stock, minimumStock, stockLevel }) => ({ id, code, name, stock, minimumStock, stockLevel })),
      },
      payments: {
        collectedToday: deCentavos(aCentavos(hoy)),
        collectedMonth: deCentavos(aCentavos(mes)),
        pendingToCollect: deCentavos(aCentavos(withBalance.amount)),
      },
    };
  }

  return { get };
}

export const dashboardService = createDashboardService();
