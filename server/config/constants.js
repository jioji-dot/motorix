// Constantes compartidas del backend.

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  MECHANIC: 'MECHANIC'
});

export const ROLE_VALUES = Object.values(ROLES);

// Estados de las citas (Sprint 2).
export const APPOINTMENT_STATUS = Object.freeze({
  PENDING: 'PENDIENTE',
  CONFIRMED: 'CONFIRMADA',
  IN_PROGRESS: 'EN_PROCESO',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA'
});

export const APPOINTMENT_STATUS_VALUES = Object.values(APPOINTMENT_STATUS);

// Estados de las órdenes de servicio (Sprint 2).
export const ORDER_STATUS = Object.freeze({
  RECEIVED: 'RECIBIDO',
  DIAGNOSIS: 'DIAGNOSTICO',
  IN_REPAIR: 'EN_REPARACION',
  WAITING_PART: 'ESPERANDO_REFACCION',
  FINISHED: 'TERMINADO',
  DELIVERED: 'ENTREGADO'
});

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

// Estados del mantenimiento programado (Sprint 3).
export const MAINTENANCE_STATUS = Object.freeze({
  PENDING: 'PENDIENTE',
  DONE: 'REALIZADO',
  CANCELLED: 'CANCELADO'
});

export const MAINTENANCE_STATUS_VALUES = Object.values(MAINTENANCE_STATUS);

// Clasificación calculada de un mantenimiento pendiente: nunca se guarda.
export const MAINTENANCE_CLASSIFICATION = Object.freeze({
  OVERDUE: 'OVERDUE',
  UPCOMING: 'UPCOMING',
  LATER: 'LATER'
});

export const MAINTENANCE_CLASSIFICATION_VALUES = Object.values(MAINTENANCE_CLASSIFICATION);

// Respaldo de los umbrales de aviso cuando falta la clave en `app_settings` (RN-12).
export const DEFAULT_MAINTENANCE_WARNING_DAYS = 30;
export const DEFAULT_MAINTENANCE_WARNING_KM = 1000;

// Tipos de movimiento de inventario (Sprint 3).
export const MOVEMENT_TYPE = Object.freeze({
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT'
});

export const MOVEMENT_TYPE_VALUES = Object.values(MOVEMENT_TYPE);

// Estado de existencia calculado de una refacción.
export const STOCK_STATUS = Object.freeze({
  OK: 'OK',
  LOW: 'LOW',
  OUT: 'OUT'
});

// Una cita no puede programarse a más de un año de distancia (FR-003).
export const MAX_APPOINTMENT_DAYS_AHEAD = 365;

// Bloqueo temporal de cuenta tras intentos fallidos de acceso (FR-002a).
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;

// Paginación de listados.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Métodos de pago (Sprint 4).
export const PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  CARD: 'CARD',
  TRANSFER: 'TRANSFER',
  MERCADO_PAGO: 'MERCADO_PAGO'
});

export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD);

// Métodos que se cobran en el taller y se aprueban al registrarse.
export const MANUAL_PAYMENT_METHODS = Object.freeze([
  PAYMENT_METHOD.CASH,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.TRANSFER
]);

// Estados de un pago.
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDIENTE',
  APPROVED: 'APROBADO',
  REJECTED: 'RECHAZADO',
  CANCELLED: 'CANCELADO',
  VOIDED: 'ANULADO'
});

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

// Estado de pago de una orden (calculado, nunca se guarda).
export const ORDER_PAYMENT_STATUS = Object.freeze({
  NO_CHARGE: 'NO_CHARGE',
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID'
});

// Solo se cobra y se emite ticket de órdenes en estos estados (el total ya no cambia).
export const BILLABLE_ORDER_STATUSES = Object.freeze([ORDER_STATUS.FINISHED, ORDER_STATUS.DELIVERED]);

// Datos del taller para el ticket cuando faltan en `app_settings`.
export const DEFAULT_WORKSHOP = Object.freeze({
  name: 'Motorix Taller Mecánico',
  address: 'Av. Principal 123, Ciudad de México',
  phone: '5555123456'
});
