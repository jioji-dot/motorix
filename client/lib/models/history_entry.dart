import 'order_status.dart';

/// Línea de servicio, mano de obra o refacción dentro de una entrada del historial.
class HistoryLine {
  const HistoryLine({required this.description, required this.amount, this.detail});

  /// Texto principal (descripción del servicio, de la mano de obra o nombre de la refacción).
  final String description;

  /// Texto secundario (horas y tarifa, o cantidad y precio unitario).
  final String? detail;
  final double amount;
}

/// Servicio terminado o entregado de un vehículo, derivado de su orden.
class HistoryEntry {
  const HistoryEntry({
    required this.orderId,
    required this.folio,
    required this.status,
    required this.serviceDate,
    required this.mileage,
    required this.reportedProblem,
    required this.services,
    required this.labor,
    required this.parts,
    required this.total,
    this.mechanicName,
    this.diagnosis,
    this.recommendations,
  });

  final int orderId;
  final String folio;
  final OrderStatus status;
  final DateTime? serviceDate;
  final int mileage;
  final String? mechanicName;
  final String reportedProblem;
  final String? diagnosis;
  final String? recommendations;
  final List<HistoryLine> services;
  final List<HistoryLine> labor;
  final List<HistoryLine> parts;
  final double total;

  static String _horas(num valor) {
    final double d = valor.toDouble();
    return d == d.roundToDouble() ? '${d.round()}' : d.toStringAsFixed(2);
  }

  factory HistoryEntry.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> lista(String clave) =>
        ((json[clave] as List<dynamic>?) ?? <dynamic>[]).cast<Map<String, dynamic>>();

    return HistoryEntry(
      orderId: json['orderId'] as int,
      folio: json['folio'] as String,
      status: OrderStatus.fromApi(json['status'] as String),
      serviceDate: DateTime.tryParse((json['serviceDate'] as String?) ?? ''),
      mileage: json['mileage'] as int,
      mechanicName: json['mechanicName'] as String?,
      reportedProblem: json['reportedProblem'] as String,
      diagnosis: json['diagnosis'] as String?,
      recommendations: json['recommendations'] as String?,
      services: lista('services')
          .map((Map<String, dynamic> s) => HistoryLine(
                description: s['description'] as String,
                amount: (s['amount'] as num).toDouble(),
              ))
          .toList(),
      labor: lista('labor')
          .map((Map<String, dynamic> l) => HistoryLine(
                description: l['description'] as String,
                detail: '${_horas(l['hours'] as num)} h × \$${_horas(l['hourlyRate'] as num)}',
                amount: (l['amount'] as num).toDouble(),
              ))
          .toList(),
      parts: lista('parts')
          .map((Map<String, dynamic> p) => HistoryLine(
                description: '${p['code']} · ${p['name']}',
                detail: '${p['quantity']} × \$${(p['unitPrice'] as num).toStringAsFixed(2)}',
                amount: (p['amount'] as num).toDouble(),
              ))
          .toList(),
      total: ((json['total'] as num?) ?? 0).toDouble(),
    );
  }
}
