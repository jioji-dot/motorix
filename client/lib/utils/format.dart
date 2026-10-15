/// Formatos de presentación (sin dependencias externas).
class Format {
  Format._();

  /// Fecha local como dd/MM/aaaa.
  static String date(DateTime? fecha) {
    if (fecha == null) return '—';
    final DateTime local = fecha.toLocal();
    final String d = local.day.toString().padLeft(2, '0');
    final String m = local.month.toString().padLeft(2, '0');
    return '$d/$m/${local.year}';
  }

  /// Kilometraje con separador de miles: 12,345 km.
  static String mileage(int km) {
    final String texto = km.toString();
    final StringBuffer salida = StringBuffer();
    for (int i = 0; i < texto.length; i++) {
      if (i > 0 && (texto.length - i) % 3 == 0) salida.write(',');
      salida.write(texto[i]);
    }
    return '$salida km';
  }

  /// Importe con separador de miles y dos decimales: $1,234.50.
  static String money(num valor) {
    final String texto = valor.toStringAsFixed(2);
    final List<String> partes = texto.split('.');
    final String entero = partes[0];
    final StringBuffer salida = StringBuffer();
    for (int i = 0; i < entero.length; i++) {
      final int restantes = entero.length - i;
      if (i > 0 && restantes % 3 == 0 && entero[i - 1] != '-') salida.write(',');
      salida.write(entero[i]);
    }
    return '\$$salida.${partes[1]}';
  }

  /// Hora local de pared `YYYY-MM-DDTHH:mm` como dd/MM/aaaa HH:mm.
  static String dateTime(String? valor) {
    if (valor == null || valor.length < 16) return '—';
    final String dia = valor.substring(8, 10);
    final String mes = valor.substring(5, 7);
    final String anio = valor.substring(0, 4);
    return '$dia/$mes/$anio ${valor.substring(11, 16)}';
  }

  /// Fecha y hora de un instante ISO (por ejemplo `createdAt`) en hora local.
  static String instant(DateTime? fecha) {
    if (fecha == null) return '—';
    final DateTime local = fecha.toLocal();
    final String h = local.hour.toString().padLeft(2, '0');
    final String m = local.minute.toString().padLeft(2, '0');
    return '${date(local)} $h:$m';
  }

  /// Texto opcional: guion largo si está vacío.
  static String orDash(String? valor) =>
      (valor == null || valor.trim().isEmpty) ? '—' : valor;

  /// Fecha de calendario como `YYYY-MM-DD` (formato del contrato de la API).
  static String isoDate(DateTime fecha) {
    final String m = fecha.month.toString().padLeft(2, '0');
    final String d = fecha.day.toString().padLeft(2, '0');
    return '${fecha.year}-$m-$d';
  }

  /// Fecha `YYYY-MM-DD` de la API como dd/MM/aaaa; guion largo si falta.
  static String dateOnly(String? valor) {
    if (valor == null || valor.length < 10) return '—';
    return '${valor.substring(8, 10)}/${valor.substring(5, 7)}/${valor.substring(0, 4)}';
  }

  /// Fecha y hora del ticket: dd/MM/aaaa HH:mm (hora local); guion largo si falta.
  static String ticketDate(DateTime? fecha) => instant(fecha);
}
