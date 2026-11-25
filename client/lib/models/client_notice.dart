import 'notification.dart';

/// Hecho pendiente de avisar a un cliente (Sprint 6, FR-015). Contiene el teléfono: solo lo reciben administración y recepción.
class PendingClientNotice {
  const PendingClientNotice({
    required this.kind,
    required this.factId,
    required this.reason,
    required this.factDate,
    required this.clientId,
    required this.clientName,
    required this.phone,
    required this.licensePlate,
    required this.vehicleTitle,
    required this.detail,
    required this.target,
  });

  /// `ORDEN_LISTA`, `CITA_MANANA`, `MANTENIMIENTO_PROXIMO` o `MANTENIMIENTO_VENCIDO`.
  final String kind;
  final int factId;
  final String reason;
  final DateTime? factDate;
  final int clientId;
  final String clientName;
  final String phone;
  final String licensePlate;
  final String vehicleTitle;
  final String detail;
  final NoticeTarget target;

  factory PendingClientNotice.fromJson(Map<String, dynamic> json) {
    final cliente = json['client'] as Map<String, dynamic>;
    final vehiculo = json['vehicle'] as Map<String, dynamic>;
    return PendingClientNotice(
      kind: json['kind'] as String,
      factId: json['factId'] as int,
      reason: json['reason'] as String,
      factDate: DateTime.tryParse(json['factDate'] as String? ?? '')?.toLocal(),
      clientId: cliente['id'] as int,
      clientName: cliente['name'] as String,
      phone: (cliente['phone'] as String?) ?? '',
      licensePlate: vehiculo['licensePlate'] as String,
      vehicleTitle: vehiculo['title'] as String,
      detail: json['detail'] as String,
      target: NoticeTarget.fromJson(json['target'] as Map<String, dynamic>),
    );
  }
}
