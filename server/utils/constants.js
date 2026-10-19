// Constantes de dominio: estados de citas y órdenes (valores exactos del modelo de datos).

export const APPOINTMENT_STATUS = Object.freeze({
  PENDING: 'PENDIENTE',
  CONFIRMED: 'CONFIRMADA',
  IN_PROGRESS: 'EN_PROCESO',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
});

export const ORDER_STATUS = Object.freeze({
  RECEIVED: 'RECIBIDO',
  DIAGNOSIS: 'DIAGNOSTICO',
  IN_REPAIR: 'EN_REPARACION',
  WAITING_PARTS: 'ESPERANDO_REFACCION',
  FINISHED: 'TERMINADO',
  DELIVERED: 'ENTREGADO',
  CANCELLED: 'CANCELADA',
});

export const APPOINTMENT_STATUSES = Object.values(APPOINTMENT_STATUS);
export const ORDER_STATUSES = Object.values(ORDER_STATUS);

// Estados en los que una orden sigue "en curso": se puede documentar y editar.
export const ORDER_OPEN_STATUSES = Object.freeze([
  ORDER_STATUS.RECEIVED,
  ORDER_STATUS.DIAGNOSIS,
  ORDER_STATUS.IN_REPAIR,
  ORDER_STATUS.WAITING_PARTS,
]);

// Estados finales: la orden ya no admite cambios.
export const ORDER_FINAL_STATUSES = Object.freeze([ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED]);

export const MAX_MILEAGE = 1500000;

// ---- Sprint 3: inventario y mantenimientos

export const MOVEMENT_TYPE = Object.freeze({ IN: 'IN', OUT: 'OUT', ADJUSTMENT: 'ADJUSTMENT' });
export const MOVEMENT_TYPES = Object.values(MOVEMENT_TYPE);

export const STOCK_LEVEL = Object.freeze({ OK: 'OK', LOW: 'LOW', OUT: 'OUT' });
export const STOCK_LEVELS = Object.values(STOCK_LEVEL);

export const MAINTENANCE_CLASS = Object.freeze({ NORMAL: 'NORMAL', SOON: 'PROXIMO', OVERDUE: 'VENCIDO' });
export const MAINTENANCE_CLASSES = Object.values(MAINTENANCE_CLASS);

export const MAINTENANCE_STATUS = Object.freeze({ PENDING: 'PENDIENTE', DONE: 'ATENDIDO' });

// Umbrales fijos de aviso (aclaración del Sprint 3): 15 días o 500 km antes del vencimiento.
export const MAINTENANCE_WARNING_DAYS = 15;
export const MAINTENANCE_WARNING_KM = 500;

export const MAX_STOCK = 1000000;
