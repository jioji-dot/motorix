import 'vehicle.dart';

/// Cliente (propietario de uno o varios vehículos).
class Client {
  const Client({
    required this.id,
    required this.name,
    required this.phone,
    required this.active,
    this.email,
    this.createdAt,
    this.vehicles = const [],
  });

  final int id;
  final String name;
  final String phone;
  final String? email;
  final bool active;
  final DateTime? createdAt;

  /// Vehículos asociados (solo se llenan en el detalle).
  final List<Vehicle> vehicles;

  factory Client.fromJson(Map<String, dynamic> json) => Client(
        id: json['id'] as int,
        name: json['name'] as String,
        phone: json['phone'] as String,
        email: json['email'] as String?,
        active: json['active'] == true || json['active'] == 1,
        createdAt: json['createdAt'] == null ? null : DateTime.tryParse(json['createdAt'] as String)?.toLocal(),
        vehicles: ((json['vehicles'] as List?) ?? const [])
            .map((v) => Vehicle.fromJson(v as Map<String, dynamic>))
            .toList(),
      );
}
