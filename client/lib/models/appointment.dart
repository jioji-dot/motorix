/// Cita agendada de un cliente con uno de sus vehículos.
class Appointment {
  const Appointment({
    required this.id,
    required this.clientId,
    required this.vehicleId,
    required this.scheduledAt,
    required this.reason,
    required this.status,
    required this.clientName,
    required this.vehicleTitle,
    required this.licensePlate,
    this.notes,
    this.orderId,
    this.clientPhone = '',
  });

  final int id;
  final int clientId;
  final int vehicleId;
  final DateTime scheduledAt;
  final String reason;
  final String? notes;

  /// PENDIENTE, CONFIRMADA, EN_PROCESO, COMPLETADA o CANCELADA.
  final String status;

  /// Orden de servicio activa asociada (si existe).
  final int? orderId;
  final String clientName;
  final String clientPhone;
  final String vehicleTitle;
  final String licensePlate;

  /// Solo las citas Pendientes o Confirmadas admiten cambios.
  bool get isEditable => status == 'PENDIENTE' || status == 'CONFIRMADA';

  bool get hasActiveOrder => orderId != null;

  factory Appointment.fromJson(Map<String, dynamic> json) {
    final cliente = json['client'] as Map<String, dynamic>;
    final vehiculo = json['vehicle'] as Map<String, dynamic>;
    return Appointment(
      id: json['id'] as int,
      clientId: json['clientId'] as int,
      vehicleId: json['vehicleId'] as int,
      scheduledAt: DateTime.parse(json['scheduledAt'] as String).toLocal(),
      reason: json['reason'] as String,
      notes: json['notes'] as String?,
      status: json['status'] as String,
      orderId: json['orderId'] as int?,
      clientName: cliente['name'] as String,
      clientPhone: (cliente['phone'] as String?) ?? '',
      vehicleTitle: '${vehiculo['brand']} ${vehiculo['model']} ${vehiculo['year']}',
      licensePlate: vehiculo['licensePlate'] as String,
    );
  }
}
