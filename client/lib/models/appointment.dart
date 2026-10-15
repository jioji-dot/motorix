import 'order_status.dart';

/// Cita tal como la devuelve la API. `scheduledAt` es la hora local de pared `YYYY-MM-DDTHH:mm`.
class Appointment {
  const Appointment({
    required this.id,
    required this.clientId,
    required this.vehicleId,
    required this.scheduledAt,
    required this.reason,
    required this.status,
    required this.clientName,
    required this.vehiclePlate,
    required this.vehicleTitle,
    this.notes,
    this.orderId,
  });

  final int id;
  final int clientId;
  final int vehicleId;
  final String scheduledAt;
  final String reason;
  final String? notes;
  final AppointmentStatus status;
  final int? orderId;
  final String clientName;
  final String vehiclePlate;
  final String vehicleTitle;

  /// Todavía se puede modificar, confirmar o cancelar (y no tiene orden).
  bool get isOpen => status.isOpen && orderId == null;

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
        id: json['id'] as int,
        clientId: json['clientId'] as int,
        vehicleId: json['vehicleId'] as int,
        scheduledAt: json['scheduledAt'] as String,
        reason: json['reason'] as String,
        notes: json['notes'] as String?,
        status: AppointmentStatus.fromApi(json['status'] as String),
        orderId: json['orderId'] as int?,
        clientName: json['clientName'] as String,
        vehiclePlate: json['vehiclePlate'] as String,
        vehicleTitle: json['vehicleTitle'] as String,
      );
}

/// Datos capturados en el formulario de cita.
class AppointmentInput {
  const AppointmentInput({
    this.clientId,
    this.vehicleId,
    required this.scheduledAt,
    required this.reason,
    this.notes,
  });

  /// Solo se envían al registrar; la cita no cambia de cliente ni de vehículo.
  final int? clientId;
  final int? vehicleId;
  final String scheduledAt;
  final String reason;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'clientId': ?clientId,
        'vehicleId': ?vehicleId,
        'scheduledAt': scheduledAt,
        'reason': reason,
        'notes': notes,
      };
}
