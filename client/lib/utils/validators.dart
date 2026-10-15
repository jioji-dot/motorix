/// Validadores de formulario con mensajes en español.
/// Cada función devuelve `null` si el valor es válido, o el mensaje de error.
class Validators {
  Validators._();

  static const String mensajePoliticaContrasena =
      'Usa al menos 8 caracteres, con una mayúscula, una minúscula y un número.';

  /// [campo] lleva su artículo para concordar en género: "el nombre", "la contraseña".
  static String? required(String? valor, [String campo = 'un valor']) {
    if (valor == null || valor.trim().isEmpty) return 'Ingresa $campo.';
    return null;
  }

  static String? maxLength(String? valor, int max) {
    if (valor != null && valor.trim().length > max) {
      return 'Máximo $max caracteres.';
    }
    return null;
  }

  /// Contraseña con la política mínima: 8 caracteres, mayúscula, minúscula y número.
  static String? password(String? valor) {
    final String texto = valor ?? '';
    final bool cumple = texto.length >= 8 &&
        RegExp(r'[A-Z]').hasMatch(texto) &&
        RegExp(r'[a-z]').hasMatch(texto) &&
        RegExp(r'[0-9]').hasMatch(texto);
    return cumple ? null : mensajePoliticaContrasena;
  }

  static final RegExp _correo = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  static String? email(String? valor, {bool obligatorio = false}) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return obligatorio ? 'El correo electrónico es obligatorio.' : null;
    if (texto.length > 150) return 'Máximo 150 caracteres.';
    return _correo.hasMatch(texto) ? null : 'Escribe un correo electrónico válido.';
  }

  /// Teléfono de 7 a 15 dígitos; admite `+`, espacios, guiones y paréntesis al capturar.
  static String? phone(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El teléfono es obligatorio.';
    if (texto.length > 20) return 'Máximo 20 caracteres.';
    if (!RegExp(r'^\+?[0-9\s\-()]+$').hasMatch(texto)) {
      return 'Usa solo números, espacios, guiones o el signo +.';
    }
    final int digitos = RegExp(r'[0-9]').allMatches(texto).length;
    if (digitos < 7 || digitos > 15) return 'El teléfono debe tener entre 7 y 15 dígitos.';
    return null;
  }

  /// Placa obligatoria de hasta 15 caracteres (se normaliza en el servidor).
  static String? licensePlate(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'La placa es obligatoria.';
    final String normalizada = texto.replaceAll(RegExp(r'[\s-]+'), '');
    if (normalizada.length > 15) return 'La placa admite máximo 15 caracteres.';
    if (!RegExp(r'^[A-Za-z0-9]+$').hasMatch(normalizada)) {
      return 'La placa solo admite letras y números.';
    }
    return null;
  }

  /// VIN opcional: 17 caracteres alfanuméricos sin I, O ni Q.
  static String? vin(String? valor) {
    final String texto = (valor ?? '').replaceAll(RegExp(r'\s+'), '');
    if (texto.isEmpty) return null;
    if (!RegExp(r'^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$').hasMatch(texto)) {
      return 'El número de identificación debe tener 17 caracteres alfanuméricos, sin I, O ni Q.';
    }
    return null;
  }

  /// Año entre 1950 y el año actual + 1.
  static String? year(String? valor, {int? anioActual}) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El año es obligatorio.';
    final int? numero = int.tryParse(texto);
    final int maximo = (anioActual ?? DateTime.now().year) + 1;
    if (numero == null || numero < 1950 || numero > maximo) {
      return 'El año debe estar entre 1950 y $maximo.';
    }
    return null;
  }

  /// Kilometraje entero no negativo (opcional).
  static String? mileage(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return null;
    final int? numero = int.tryParse(texto);
    if (numero == null || numero < 0) return 'El kilometraje debe ser un número entero no negativo.';
    return null;
  }

  /// Descripción obligatoria de 1 a 255 caracteres (servicios y mano de obra).
  static String? description(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'Ingresa la descripción.';
    if (texto.length > 255) return 'La descripción admite máximo 255 caracteres.';
    return null;
  }

  static final RegExp _decimal = RegExp(r'^\d+([.,]\d{1,2})?$');

  /// Convierte un texto con punto o coma decimal a número; null si no es un decimal válido.
  static double? parseDecimal(String? valor) {
    final String texto = (valor ?? '').trim();
    if (!_decimal.hasMatch(texto)) return null;
    return double.tryParse(texto.replaceAll(',', '.'));
  }

  /// Importe o tarifa: número mayor o igual a 0 con máximo dos decimales.
  static String? amount(String? valor, [String campo = 'el importe']) {
    if ((valor ?? '').trim().isEmpty) return 'Ingresa $campo.';
    if (parseDecimal(valor) == null) {
      return 'Usa un número mayor o igual a 0 con máximo dos decimales.';
    }
    return null;
  }

  /// Horas: número mayor a 0 y hasta 9999,99 con máximo dos decimales.
  static String? hours(String? valor) {
    if ((valor ?? '').trim().isEmpty) return 'Ingresa las horas.';
    final double? horas = parseDecimal(valor);
    if (horas == null || horas <= 0 || horas > 9999.99) {
      return 'Las horas deben ser mayores a 0 y hasta 9999.99, con máximo dos decimales.';
    }
    return null;
  }

  /// Fecha y hora de una cita (`YYYY-MM-DDTHH:mm`): obligatoria, futura y dentro de un año.
  static String? futureDateTime(String? valor, {DateTime? now}) {
    if (valor == null || valor.isEmpty) return 'Elige la fecha y la hora.';
    final DateTime? fecha = DateTime.tryParse(valor);
    if (fecha == null) return 'La fecha y la hora no son válidas.';
    final DateTime ahora = now ?? DateTime.now();
    if (!fecha.isAfter(ahora)) return 'La cita debe ser en una fecha y hora futuras.';
    if (fecha.isAfter(ahora.add(const Duration(days: 365)))) {
      return 'La cita no puede ser a más de un año de distancia.';
    }
    return null;
  }

  /// Usuario de 3 a 50 caracteres: letras, números, `.`, `_` y `-`.
  static String? username(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El usuario es obligatorio.';
    if (texto.length < 3 || texto.length > 50) return 'El usuario debe tener de 3 a 50 caracteres.';
    if (!RegExp(r'^[A-Za-z0-9._-]+$').hasMatch(texto)) {
      return 'El usuario solo admite letras, números, punto, guion y guion bajo.';
    }
    return null;
  }

  /// Código de refacción obligatorio de hasta 40 caracteres (se normaliza a mayúsculas en el servidor).
  static String? partCode(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El código es obligatorio.';
    if (texto.length > 40) return 'El código admite máximo 40 caracteres.';
    return null;
  }

  /// Cantidad entera mayor o igual a 1 (refacciones usadas y entradas de inventario).
  static String? quantity(String? valor, [String campo = 'la cantidad']) {
    if ((valor ?? '').trim().isEmpty) return 'Ingresa $campo.';
    final int? numero = int.tryParse(valor!.trim());
    if (numero == null || numero < 1) return 'Usa un número entero mayor o igual a 1.';
    return null;
  }

  /// Existencia o mínimo: entero mayor o igual a 0 (obligatorio).
  static String? stock(String? valor, [String campo = 'la existencia']) {
    if ((valor ?? '').trim().isEmpty) return 'Ingresa $campo.';
    final int? numero = int.tryParse(valor!.trim());
    if (numero == null || numero < 0) return 'Usa un número entero mayor o igual a 0.';
    return null;
  }

  /// Fecha `YYYY-MM-DD` opcional que no puede ser anterior a hoy (mantenimientos).
  static String? optionalFutureDate(String? valor, {DateTime? now}) {
    if (valor == null || valor.isEmpty) return null;
    final DateTime? fecha = DateTime.tryParse(valor);
    if (fecha == null) return 'La fecha no es válida.';
    final DateTime hoy = now ?? DateTime.now();
    final DateTime inicioHoy = DateTime(hoy.year, hoy.month, hoy.day);
    if (fecha.isBefore(inicioHoy)) return 'La fecha no puede ser anterior a hoy.';
    return null;
  }
}
