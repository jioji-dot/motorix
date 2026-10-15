/// Error devuelto por la API con el formato `{ error: { code, message, details } }`.
class ApiError implements Exception {
  ApiError({
    required this.status,
    required this.code,
    required this.message,
    this.details,
  });

  final int status;
  final String code;
  final String message;
  final dynamic details;

  /// Error de conexión (sin respuesta del servidor).
  factory ApiError.network() => ApiError(
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      );

  factory ApiError.fromResponse(int status, Map<String, dynamic>? cuerpo) {
    final dynamic error = cuerpo?['error'];
    if (error is Map<String, dynamic>) {
      return ApiError(
        status: status,
        code: (error['code'] as String?) ?? 'INTERNAL_ERROR',
        message: (error['message'] as String?) ?? 'Ocurrió un error inesperado.',
        details: error['details'],
      );
    }
    return ApiError(
      status: status,
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  }

  /// Mensaje de un campo concreto dentro de `details` (errores de validación).
  String? fieldMessage(String field) {
    if (details is List) {
      for (final dynamic item in details as List<dynamic>) {
        if (item is Map && item['field'] == field) {
          return item['message'] as String?;
        }
      }
    }
    return null;
  }

  /// Valor de `details[clave]` cuando `details` es un mapa.
  dynamic detail(String clave) => details is Map ? (details as Map)[clave] : null;

  @override
  String toString() => 'ApiError($status, $code, $message)';
}
