// Panel de control del administrador: reúne indicadores de órdenes, citas, mantenimientos, inventario
// y pagos con las mismas reglas de los módulos de origen. No guarda nada; calcula al consultar.
import { ORDER_STATUS } from '../config/constants.js';
import * as dashboardModel from '../models/dashboardModel.js';
import * as maintenanceModel from '../models/maintenanceModel.js';
import * as partModel from '../models/partModel.js';
import * as settingsModel from '../models/settingsModel.js';
import { formatLocal, todayLocal } from '../utils/localDateTime.js';

/** Cuántas refacciones críticas lista el panel. */
const CRITICAL_PARTS_LIMIT = 5;

export async function getDashboard() {
  const ahora = new Date();
  const today = todayLocal(ahora);
  // Hora local de pared con segundos, como se guardan las citas.
  const now = `${formatLocal(ahora).replace('T', ' ')}:00`;

  const thresholds = await settingsModel.getMaintenanceThresholds();
  const [porEstado, entregadasHoy, citas, siguiente, mantenimientos, alertas, criticas, cobradoHoy, porCobrar] =
    await Promise.all([
      dashboardModel.ordersByStatus(),
      dashboardModel.deliveredToday(),
      dashboardModel.appointmentCounts({ today }),
      dashboardModel.nextAppointment({ now }),
      maintenanceModel.countByClassification({ today, thresholds }),
      partModel.countAlerts(),
      dashboardModel.criticalParts(CRITICAL_PARTS_LIMIT),
      dashboardModel.collectedToday(),
      dashboardModel.receivableTotals()
    ]);

  return {
    generatedAt: ahora.toISOString(),
    orders: {
      received: porEstado[ORDER_STATUS.RECEIVED] ?? 0,
      diagnosis: porEstado[ORDER_STATUS.DIAGNOSIS] ?? 0,
      inRepair: porEstado[ORDER_STATUS.IN_REPAIR] ?? 0,
      waitingPart: porEstado[ORDER_STATUS.WAITING_PART] ?? 0,
      finishedNotDelivered: porEstado[ORDER_STATUS.FINISHED] ?? 0,
      deliveredToday: entregadasHoy
    },
    appointments: { today: citas.today, next7Days: citas.next7Days, next: siguiente },
    maintenance: {
      overdue: mantenimientos.overdue,
      upcoming: mantenimientos.upcoming,
      warningDays: thresholds.warningDays,
      warningKm: thresholds.warningKm
    },
    inventory: { low: alertas.low, out: alertas.out, critical: criticas },
    payments: {
      collectedToday: cobradoHoy,
      pendingBalance: porCobrar.pendingBalance,
      ordersToCollect: porCobrar.ordersToCollect
    }
  };
}
