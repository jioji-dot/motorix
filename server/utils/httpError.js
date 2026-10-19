// Error de aplicación con código, estado HTTP y mensaje en español para el usuario final.
export class HttpError extends Error {
  constructor(status, code, message, details = undefined, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.extra = extra;
  }

  static validation(message, details) {
    return new HttpError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Debes iniciar sesión para continuar.') {
    return new HttpError(401, 'UNAUTHENTICATED', message);
  }

  static invalidCredentials() {
    return new HttpError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
  }

  static forbidden(message = 'No tienes permiso para realizar esta acción.') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static accountDisabled() {
    return new HttpError(403, 'ACCOUNT_DISABLED', 'Tu cuenta está desactivada. Contacta al administrador.');
  }

  static notFound(message = 'No se encontró el registro solicitado.') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static duplicate(message, details) {
    return new HttpError(409, 'DUPLICATE_VALUE', message, details);
  }

  static locked(retryAfterSeconds) {
    const minutos = Math.ceil(retryAfterSeconds / 60);
    return new HttpError(
      423,
      'ACCOUNT_LOCKED',
      `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
      undefined,
      { retryAfterSeconds },
    );
  }
}
