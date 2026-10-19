/// Da formato "55 1234 5678" a un teléfono de 10 dígitos.
String formatPhone(String phone) {
  if (phone.length != 10) return phone;
  return '${phone.substring(0, 2)} ${phone.substring(2, 6)} ${phone.substring(6)}';
}

/// Da formato de miles al kilometraje: 45000 → "45,000 km".
String formatMileage(int km) {
  final texto = km.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < texto.length; i++) {
    if (i > 0 && (texto.length - i) % 3 == 0) buffer.write(',');
    buffer.write(texto[i]);
  }
  return '$buffer km';
}

/// Fecha corta dd/mm/aaaa.
String formatDate(DateTime? fecha) {
  if (fecha == null) return '—';
  String dos(int n) => n.toString().padLeft(2, '0');
  return '${dos(fecha.day)}/${dos(fecha.month)}/${fecha.year}';
}

/// Fecha y hora corta: dd/mm/aaaa HH:mm.
String formatDateTime(DateTime? fecha) {
  if (fecha == null) return '—';
  String dos(int n) => n.toString().padLeft(2, '0');
  return '${formatDate(fecha)} ${dos(fecha.hour)}:${dos(fecha.minute)}';
}

/// Importe en pesos con dos decimales: "1250.5" → "$1,250.50".
String formatMoney(Object? importe) {
  final valor = double.tryParse(importe?.toString() ?? '') ?? 0;
  final partes = valor.toStringAsFixed(2).split('.');
  final entero = partes[0];
  final buffer = StringBuffer();
  for (var i = 0; i < entero.length; i++) {
    if (i > 0 && (entero.length - i) % 3 == 0) buffer.write(',');
    buffer.write(entero[i]);
  }
  return '\$$buffer.${partes[1]}';
}
