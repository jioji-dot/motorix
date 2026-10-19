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
