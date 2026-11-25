/// Acción de la bitácora en español.
String auditActionLabel(String accion) => switch (accion) {
  'LOGIN_FAILED' => 'Inicio de sesión fallido',
  'ACCOUNT_LOCKED' => 'Cuenta bloqueada',
  'USER_CREATED' => 'Usuario creado',
  'USER_DEACTIVATED' => 'Usuario desactivado',
  'USER_REACTIVATED' => 'Usuario reactivado',
  'USER_ROLE_CHANGED' => 'Cambio de rol',
  'SETTINGS_CHANGED' => 'Cambio de configuración',
  'PART_PRICE_CHANGED' => 'Cambio de precio de refacción',
  'SERVICE_TYPE_CREATED' => 'Tipo de servicio creado',
  'SERVICE_TYPE_UPDATED' => 'Tipo de servicio modificado',
  'PAYMENT_CANCELLED' => 'Pago cancelado',
  'TERMS_PUBLISHED' => 'Términos publicados',
  _ => accion,
};

/// Acciones que se pueden filtrar en la bitácora.
const auditActions = [
  'LOGIN_FAILED',
  'ACCOUNT_LOCKED',
  'USER_CREATED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'USER_ROLE_CHANGED',
  'SETTINGS_CHANGED',
  'PART_PRICE_CHANGED',
  'SERVICE_TYPE_CREATED',
  'SERVICE_TYPE_UPDATED',
  'PAYMENT_CANCELLED',
  'TERMS_PUBLISHED',
];

/// Entrada de la bitácora de acciones sensibles (solo lectura, sin secretos).
class AuditEntry {
  const AuditEntry({
    required this.id,
    required this.action,
    this.entity,
    this.entityId,
    this.userName,
    this.actorLabel,
    this.detail,
    required this.createdAt,
  });

  final int id;
  final String action;
  final String? entity;
  final int? entityId;
  final String? userName;
  final String? actorLabel;
  final Map<String, dynamic>? detail;
  final DateTime? createdAt;

  /// Quién hizo la acción: el usuario o, si no hay cuenta, el identificador escrito.
  String get who => userName ?? actorLabel ?? '—';

  factory AuditEntry.fromJson(Map<String, dynamic> json) => AuditEntry(
    id: json['id'] as int,
    action: json['action'] as String,
    entity: json['entity'] as String?,
    entityId: json['entityId'] as int?,
    userName: (json['user'] as Map<String, dynamic>?)?['name'] as String?,
    actorLabel: json['actorLabel'] as String?,
    detail: json['detail'] as Map<String, dynamic>?,
    createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '')
        ?.toLocal(),
  );
}
