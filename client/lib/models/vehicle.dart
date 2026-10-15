/// Vehículo tal como lo devuelve la API.
class Vehicle {
  const Vehicle({
    required this.id,
    required this.clientId,
    required this.brand,
    required this.model,
    required this.year,
    required this.licensePlate,
    this.vin,
    this.color,
    this.currentMileage = 0,
    this.ownerName,
    this.ownerPhone,
  });

  final int id;
  final int clientId;
  final String brand;
  final String model;
  final int year;
  final String licensePlate;
  final String? vin;
  final String? color;
  final int currentMileage;

  /// Nombre del propietario (viene en listados y en el detalle).
  final String? ownerName;
  final String? ownerPhone;

  String get title => '$brand $model';

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? owner = json['owner'] as Map<String, dynamic>?;
    return Vehicle(
      id: json['id'] as int,
      clientId: json['clientId'] as int,
      brand: json['brand'] as String,
      model: json['model'] as String,
      year: json['year'] as int,
      licensePlate: json['licensePlate'] as String,
      vin: json['vin'] as String?,
      color: json['color'] as String?,
      currentMileage: (json['currentMileage'] as int?) ?? 0,
      ownerName: (owner?['name'] as String?) ?? (json['ownerName'] as String?),
      ownerPhone: owner?['phone'] as String?,
    );
  }
}

/// Datos capturados en el formulario de vehículo.
class VehicleInput {
  const VehicleInput({
    this.clientId,
    required this.brand,
    required this.model,
    required this.year,
    required this.licensePlate,
    this.vin,
    this.color,
    this.currentMileage,
  });

  /// Solo se envía al registrar; el propietario no cambia al editar.
  final int? clientId;
  final String brand;
  final String model;
  final int year;
  final String licensePlate;
  final String? vin;
  final String? color;
  final int? currentMileage;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'clientId': ?clientId,
        'brand': brand,
        'model': model,
        'year': year,
        'licensePlate': licensePlate,
        'vin': vin,
        'color': color,
        'currentMileage': ?currentMileage,
      };
}
