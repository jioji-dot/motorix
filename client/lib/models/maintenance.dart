/// Mantenimiento programado de un vehículo. La clasificación la calcula el servidor al consultarlo.
class Maintenance {
  const Maintenance({
    required this.id,
    required this.vehicleId,
    required this.serviceType,
    required this.lastServiceDate,
    required this.lastMileage,
    required this.status,
    required this.vehicleTitle,
    required this.licensePlate,
    required this.currentMileage,
    required this.clientId,
    required this.clientName,
    this.nextDate,
    this.nextMileage,
    this.notes,
    this.sourceOrderId,
    this.classification,
    this.daysLeft,
    this.kmLeft,
    this.clientPhone,
  });

  final int id;
  final int vehicleId;
  final String serviceType;
  final DateTime lastServiceDate;
  final int lastMileage;
  final DateTime? nextDate;
  final int? nextMileage;
  final String? notes;

  /// PENDIENTE o ATENDIDO.
  final String status;
  final int? sourceOrderId;

  /// NORMAL, PROXIMO o VENCIDO; nulo si ya fue atendido.
  final String? classification;

  /// Días y kilómetros restantes (negativos si ya se pasó); nulos si el mantenimiento no tiene ese valor.
  final int? daysLeft;
  final int? kmLeft;
  final String vehicleTitle;
  final String licensePlate;
  final int currentMileage;
  final int clientId;
  final String clientName;
  final String? clientPhone;

  bool get isPending => status == 'PENDIENTE';

  static DateTime? _fecha(Object? valor) => valor == null ? null : DateTime.parse('${valor as String}T00:00:00');

  factory Maintenance.fromJson(Map<String, dynamic> json) {
    final vehiculo = json['vehicle'] as Map<String, dynamic>;
    final cliente = json['client'] as Map<String, dynamic>;
    return Maintenance(
      id: json['id'] as int,
      vehicleId: json['vehicleId'] as int,
      serviceType: json['serviceType'] as String,
      lastServiceDate: _fecha(json['lastServiceDate'])!,
      lastMileage: json['lastMileage'] as int,
      nextDate: _fecha(json['nextDate']),
      nextMileage: json['nextMileage'] as int?,
      notes: json['notes'] as String?,
      status: json['status'] as String,
      sourceOrderId: json['sourceOrderId'] as int?,
      classification: json['classification'] as String?,
      daysLeft: json['daysLeft'] as int?,
      kmLeft: json['kmLeft'] as int?,
      vehicleTitle: '${vehiculo['brand']} ${vehiculo['model']} ${vehiculo['year']}',
      licensePlate: vehiculo['licensePlate'] as String,
      currentMileage: vehiculo['currentMileage'] as int,
      clientId: cliente['id'] as int,
      clientName: cliente['name'] as String,
      clientPhone: cliente['phone'] as String?,
    );
  }
}
