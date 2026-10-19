/// Roles de acceso del sistema.
enum UserRole {
  admin('ADMIN', 'Administrador'),
  receptionist('RECEPTIONIST', 'Recepcionista'),
  mechanic('MECHANIC', 'Mecánico');

  const UserRole(this.value, this.label);

  final String value;
  final String label;

  static UserRole fromValue(String value) =>
      UserRole.values.firstWhere((rol) => rol.value == value, orElse: () => UserRole.mechanic);
}

/// Usuario del taller (sin datos sensibles).
class User {
  const User({
    required this.id,
    required this.username,
    required this.name,
    required this.email,
    required this.role,
    this.active = true,
  });

  final int id;
  final String username;
  final String name;
  final String email;
  final UserRole role;
  final bool active;

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as int,
        username: json['username'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: UserRole.fromValue(json['role'] as String),
        active: (json['active'] ?? 1) == 1 || json['active'] == true,
      );
}
