/// Destino de un aviso: qué pantalla abre (Sprint 6, FR-010).
class NoticeTarget {
  const NoticeTarget({required this.kind, required this.id, this.search});

  /// `order`, `appointment`, `part` o `maintenance`.
  final String kind;
  final int id;

  /// Placa con la que se prellena el buscador de Mantenimientos.
  final String? search;

  factory NoticeTarget.fromJson(Map<String, dynamic> json) => NoticeTarget(
        kind: json['kind'] as String,
        id: json['id'] as int,
        search: json['search'] as String?,
      );
}

/// Aviso interno. Se calcula en el servidor al consultar; la aplicación solo guarda lo que recibe.
class AppNotice {
  const AppNotice({
    required this.key,
    required this.type,
    required this.read,
    required this.title,
    required this.detail,
    required this.target,
  });

  /// Identidad del aviso: tipo, objeto y estado (por ejemplo `MANT:12:VENCIDO`).
  final String key;
  final String type;
  final bool read;
  final String title;
  final String detail;
  final NoticeTarget target;

  factory AppNotice.fromJson(Map<String, dynamic> json) => AppNotice(
        key: json['key'] as String,
        type: json['type'] as String,
        read: json['read'] as bool,
        title: json['title'] as String,
        detail: json['detail'] as String,
        target: NoticeTarget.fromJson(json['target'] as Map<String, dynamic>),
      );
}

/// Avisos de un mismo tipo. `total` y `unread` cuentan todos los avisos del tipo aunque el panel muestre solo algunos.
class NoticeGroup {
  const NoticeGroup({required this.type, required this.total, required this.unread, required this.items});

  final String type;
  final int total;
  final int unread;
  final List<AppNotice> items;

  /// Avisos del tipo que el panel no muestra por el tope por tipo.
  int get hidden => total - items.length;

  factory NoticeGroup.fromJson(Map<String, dynamic> json) => NoticeGroup(
        type: json['type'] as String,
        total: json['total'] as int,
        unread: json['unread'] as int,
        items: (json['items'] as List<dynamic>).map((e) => AppNotice.fromJson(e as Map<String, dynamic>)).toList(),
      );

  /// Título del grupo en el panel.
  String get title => switch (type) {
        'MAINTENANCE_OVERDUE' => 'Mantenimientos vencidos',
        'MAINTENANCE_SOON' => 'Mantenimientos próximos',
        'APPOINTMENT_TODAY' => 'Citas de hoy',
        'STOCK_OUT' => 'Refacciones agotadas',
        'STOCK_LOW' => 'Refacciones con stock bajo',
        'ORDER_STALLED' => 'Órdenes detenidas',
        _ => type,
      };
}

/// Respuesta de `GET /notifications`.
class NotificationsData {
  const NotificationsData({
    required this.unread,
    required this.total,
    required this.groups,
    this.stockAlerts = 0,
    this.clientsToNotify = 0,
  });

  final int unread;
  final int total;
  final List<NoticeGroup> groups;

  /// Alertas de stock (solo para el administrador): alimenta la insignia de Inventario.
  final int stockAlerts;

  /// Clientes por avisar (administrador y recepción): alimenta la insignia de «Clientes por avisar».
  final int clientsToNotify;

  factory NotificationsData.fromJson(Map<String, dynamic> json) => NotificationsData(
        unread: json['unread'] as int,
        total: json['total'] as int,
        groups: (json['groups'] as List<dynamic>).map((e) => NoticeGroup.fromJson(e as Map<String, dynamic>)).toList(),
        stockAlerts: (json['stockAlerts'] as int?) ?? 0,
        clientsToNotify: (json['clientsToNotify'] as int?) ?? 0,
      );
}
