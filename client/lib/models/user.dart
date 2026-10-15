/// Roles de acceso del sistema (coinciden con los valores de la API).
enum UserRole {
  admin('ADMIN', 'Administrador'),
  receptionist('RECEPTIONIST', 'Recepcionista'),
  mechanic('MECHANIC', 'Mecánico');

  const UserRole(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static UserRole fromApi(String valor) =>
      UserRole.values.firstWhere((UserRole r) => r.apiValue == valor, orElse: () => UserRole.mechanic);

  /// Puede crear y editar clientes y vehículos.
  bool get canManageRecords => this == UserRole.admin || this == UserRole.receptionist;

  bool get canManageUsers => this == UserRole.admin;
}

/// Usuario del sistema tal como lo devuelve la API.
class AppUser {
  const AppUser({
    required this.id,
    required this.username,
    required this.name,
    required this.email,
    required this.role,
    this.active = true,
    this.createdAt,
  });

  final int id;
  final String username;
  final String name;
  final String email;
  final UserRole role;
  final bool active;
  final DateTime? createdAt;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as int,
        username: json['username'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: UserRole.fromApi(json['role'] as String),
        active: (json['active'] as bool?) ?? true,
        createdAt: json['createdAt'] == null ? null : DateTime.tryParse(json['createdAt'] as String),
      );
}
