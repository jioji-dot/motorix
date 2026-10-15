import 'vehicle.dart';

/// Cliente (propietario de vehículos) tal como lo devuelve la API.
class Client {
  const Client({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.address,
    this.createdAt,
    this.vehicles = const <Vehicle>[],
  });

  final int id;
  final String name;
  final String phone;
  final String? email;
  final String? address;
  final DateTime? createdAt;

  /// Solo viene en el detalle del cliente.
  final List<Vehicle> vehicles;

  factory Client.fromJson(Map<String, dynamic> json) => Client(
        id: json['id'] as int,
        name: json['name'] as String,
        phone: json['phone'] as String,
        email: json['email'] as String?,
        address: json['address'] as String?,
        createdAt: json['createdAt'] == null ? null : DateTime.tryParse(json['createdAt'] as String),
        vehicles: ((json['vehicles'] as List<dynamic>?) ?? <dynamic>[])
            .map((dynamic v) => Vehicle.fromJson(v as Map<String, dynamic>))
            .toList(),
      );
}

/// Datos capturados en el formulario de cliente.
class ClientInput {
  const ClientInput({required this.name, required this.phone, this.email, this.address});

  final String name;
  final String phone;
  final String? email;
  final String? address;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'phone': phone,
        'email': email,
        'address': address,
      };
}
