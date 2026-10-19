import 'service_order.dart';

/// Entrada del historial de servicios de un vehículo (una orden terminada o entregada).
class HistoryEntry {
  const HistoryEntry({
    required this.orderId,
    required this.folio,
    required this.status,
    required this.serviceDate,
    required this.mileage,
    required this.mechanicName,
    required this.total,
    this.diagnosis,
    this.notes,
    this.recommendations,
    this.services = const [],
    this.labor = const [],
    this.parts = const [],
  });

  final int orderId;
  final String folio;
  final String status;
  final DateTime serviceDate;
  final int mileage;
  final String mechanicName;
  final String total;
  final String? diagnosis;
  final String? notes;
  final String? recommendations;
  final List<OrderService> services;
  final List<OrderLabor> labor;
  final List<OrderPart> parts;

  factory HistoryEntry.fromJson(Map<String, dynamic> json) {
    List<T> lista<T>(String clave, T Function(Map<String, dynamic>) f) =>
        ((json[clave] as List?) ?? const []).map((e) => f(e as Map<String, dynamic>)).toList();

    return HistoryEntry(
      orderId: json['orderId'] as int,
      folio: json['folio'] as String,
      status: json['status'] as String,
      serviceDate: DateTime.parse(json['serviceDate'] as String).toLocal(),
      mileage: json['mileage'] as int,
      mechanicName: (json['mechanic'] as Map<String, dynamic>)['name'] as String,
      total: json['total'].toString(),
      diagnosis: json['diagnosis'] as String?,
      notes: json['notes'] as String?,
      recommendations: json['recommendations'] as String?,
      services: lista('services', OrderService.fromJson),
      labor: lista('labor', OrderLabor.fromJson),
      parts: lista('parts', OrderPart.fromJson),
    );
  }
}
