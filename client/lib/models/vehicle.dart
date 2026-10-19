/// Vehículo de un cliente.
class Vehicle {
  const Vehicle({
    required this.id,
    required this.brand,
    required this.model,
    required this.year,
    required this.licensePlate,
    required this.currentMileage,
    this.vin,
    this.clientId,
    this.clientName,
    this.clientPhone,
  });

  final int id;
  final int? clientId;
  final String brand;
  final String model;
  final int year;
  final String licensePlate;
  final String? vin;
  final int currentMileage;

  /// Datos del propietario (solo vienen en el detalle y en los listados de vehículos).
  final String? clientName;
  final String? clientPhone;

  String get title => '$brand $model $year';

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    final cliente = json['client'] as Map<String, dynamic>?;
    return Vehicle(
      id: json['id'] as int,
      clientId: (json['clientId'] ?? cliente?['id']) as int?,
      brand: json['brand'] as String,
      model: json['model'] as String,
      year: json['year'] as int,
      licensePlate: json['licensePlate'] as String,
      vin: json['vin'] as String?,
      currentMileage: json['currentMileage'] as int,
      clientName: (json['clientName'] ?? cliente?['name']) as String?,
      clientPhone: (json['clientPhone'] ?? cliente?['phone']) as String?,
    );
  }
}
