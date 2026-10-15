// Error de aplicación con código HTTP y código de negocio (ver contracts/api.md).

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  validation: (message = 'Los datos enviados no son válidos.', details) =>
    new AppError(400, 'VALIDATION_ERROR', message, details),
  invalidCredentials: () =>
    new AppError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.'),
  unauthenticated: (message = 'Debes iniciar sesión para continuar.') =>
    new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'No tienes permiso para realizar esta acción.') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'No se encontró el recurso solicitado.', details) =>
    new AppError(404, 'NOT_FOUND', message, details),
  duplicateUsername: () =>
    new AppError(409, 'DUPLICATE_USERNAME', 'Ya existe un usuario con ese nombre de usuario.', {
      field: 'username'
    }),
  duplicateEmail: () =>
    new AppError(409, 'DUPLICATE_EMAIL', 'Ya existe un usuario con ese correo electrónico.', {
      field: 'email'
    }),
  duplicateLicensePlate: () =>
    new AppError(409, 'DUPLICATE_LICENSE_PLATE', 'Ya existe un vehículo con esa placa.', {
      field: 'licensePlate'
    }),
  duplicateVin: () =>
    new AppError(
      409,
      'DUPLICATE_VIN',
      'Ya existe un vehículo con ese número de identificación.',
      { field: 'vin' }
    ),
  phoneDuplicateWarning: (matches) =>
    new AppError(
      409,
      'PHONE_DUPLICATE_WARNING',
      'Ya existe un cliente con ese teléfono. Confirma para guardar de todas formas.',
      { field: 'phone', matches }
    ),
  appointmentDuplicateWarning: (matches) =>
    new AppError(
      409,
      'APPOINTMENT_DUPLICATE_WARNING',
      'Ya hay una cita de este vehículo el mismo día. Confirma para registrarla de todas formas.',
      { matches }
    ),
  appointmentNotEditable: () =>
    new AppError(
      409,
      'APPOINTMENT_NOT_EDITABLE',
      'Solo se pueden modificar citas pendientes o confirmadas.'
    ),
  appointmentHasOrder: () =>
    new AppError(
      409,
      'APPOINTMENT_HAS_ORDER',
      'La cita ya tiene una orden de servicio y no se puede cancelar.'
    ),
  appointmentNotAvailable: () =>
    new AppError(
      409,
      'APPOINTMENT_NOT_AVAILABLE',
      'La cita no está disponible: debe estar pendiente o confirmada y no tener orden.'
    ),
  invalidTransition: (from, to, allowed) =>
    new AppError(
      409,
      'INVALID_TRANSITION',
      `No se puede pasar la orden de ${from} a ${to}.` +
        (allowed.length > 0
          ? ` Estados válidos: ${allowed.join(', ')}.`
          : ' La orden ya no admite cambios de estado.'),
      { from, to, allowed }
    ),
  mechanicRequired: () =>
    new AppError(
      409,
      'MECHANIC_REQUIRED',
      'Asigna un mecánico a la orden antes de avanzar su estado.'
    ),
  orderIncomplete: (missing) =>
    new AppError(
      409,
      'ORDER_INCOMPLETE',
      'Para terminar la orden registra el diagnóstico y al menos un servicio o una línea de mano de obra.',
      { missing }
    ),
  orderNotEditable: (status) =>
    new AppError(
      409,
      'ORDER_NOT_EDITABLE',
      `La orden en estado ${status} no admite este cambio.`,
      { status }
    ),
  insufficientStock: ({ partId, available, requested }) =>
    new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `No hay existencia suficiente: disponible ${available}, solicitado ${requested}.`,
      { partId, available, requested }
    ),
  partCodeDuplicate: () =>
    new AppError(409, 'PART_CODE_DUPLICATE', 'Ya existe una refacción con ese código.', {
      field: 'code'
    }),
  partInactive: () =>
    new AppError(
      409,
      'PART_INACTIVE',
      'La refacción está inactiva y no se puede agregar a una orden.'
    ),
  maintenancePendingExists: (pending) =>
    new AppError(
      409,
      'MAINTENANCE_PENDING_EXISTS',
      'El vehículo ya tiene un mantenimiento pendiente. Confirma para reemplazarlo.',
      { pending }
    ),
  maintenanceNotPending: () =>
    new AppError(
      409,
      'MAINTENANCE_NOT_PENDING',
      'Solo se pueden modificar o cerrar mantenimientos pendientes.'
    ),
  orderNotFinished: () =>
    new AppError(
      409,
      'ORDER_NOT_FINISHED',
      'El mantenimiento se registra desde una orden terminada o entregada.'
    ),
  paymentOrderNotPayable: ({ status, total }) =>
    new AppError(
      409,
      'PAYMENT_ORDER_NOT_PAYABLE',
      'Solo se cobran órdenes terminadas o entregadas con un total mayor a cero.',
      { status, total }
    ),
  paymentExceedsBalance: ({ available, requested }) =>
    new AppError(
      409,
      'PAYMENT_EXCEEDS_BALANCE',
      `El importe supera el saldo disponible de la orden (${available}).`,
      { available, requested }
    ),
  paymentPendingExists: (pending) =>
    new AppError(
      409,
      'PAYMENT_PENDING_EXISTS',
      'La orden ya tiene un cobro de Mercado Pago pendiente. Cancélalo o actualiza su estado primero.',
      { pending }
    ),
  paymentInvalidState: (message = 'La operación no aplica al estado actual del pago.') =>
    new AppError(409, 'PAYMENT_INVALID_STATE', message),
  ticketOrderNotReady: () =>
    new AppError(
      409,
      'TICKET_ORDER_NOT_READY',
      'El ticket se genera cuando la orden está terminada o entregada.'
    ),
  paymentProviderUnavailable: (
    message = 'Mercado Pago no está disponible por ahora. Cobra con otro método o inténtalo más tarde.'
  ) => new AppError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', message),
  lastAdminProtected: (
    message = 'No se puede dejar el sistema sin un administrador activo.'
  ) => new AppError(409, 'LAST_ADMIN_PROTECTED', message),
  mileageDecrease: () =>
    new AppError(
      409,
      'MILEAGE_DECREASE',
      'El kilometraje no puede ser menor al registrado. Si es una corrección, confírmala explícitamente.',
      { field: 'currentMileage' }
    ),
  accountLocked: (retryAfterSeconds) =>
    new AppError(
      423,
      'ACCOUNT_LOCKED',
      'La cuenta está bloqueada temporalmente por demasiados intentos fallidos. Inténtalo más tarde.',
      { retryAfterSeconds }
    ),
  internal: () =>
    new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.')
};
