/// Reportes del administrador (Sprint 7). `path` es el nombre de la ruta de la API.
enum ReportKind {
  income('income', 'Ingresos'),
  services('services', 'Servicios frecuentes'),
  productivity('productivity', 'Productividad'),
  parts('parts', 'Refacciones'),
  rotation('rotation', 'Rotación de inventario');

  const ReportKind(this.path, this.label);

  final String path;
  final String label;
}

/// Texto del periodo de un reporte de ingresos: «2026-11-24» o «2026-11».
String periodLabel(String periodo) {
  final partes = periodo.split('-');
  if (partes.length == 3) return '${partes[2]}/${partes[1]}/${partes[0]}';
  if (partes.length == 2) return '${partes[1]}/${partes[0]}';
  return periodo;
}

/// Nombre en español del método de pago de la API.
String paymentMethodName(String metodo) => switch (metodo) {
      'EFECTIVO' => 'Efectivo',
      'TARJETA' => 'Tarjeta',
      'TRANSFERENCIA' => 'Transferencia',
      'MERCADO_PAGO' => 'Mercado Pago',
      _ => metodo,
    };
