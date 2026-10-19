/// Servicio realizado en una orden.
class OrderService {
  const OrderService({required this.id, required this.description, required this.amount});

  final int id;
  final String description;

  /// Importe con dos decimales, como lo devuelve la API (por ejemplo "1250.00").
  final String amount;

  factory OrderService.fromJson(Map<String, dynamic> json) => OrderService(
        id: json['id'] as int,
        description: json['description'] as String,
        amount: json['amount'].toString(),
      );
}

/// Mano de obra de una orden.
class OrderLabor {
  const OrderLabor({
    required this.id,
    required this.description,
    required this.hours,
    required this.hourlyRate,
    required this.amount,
  });

  final int id;
  final String description;
  final String hours;
  final String hourlyRate;
  final String amount;

  factory OrderLabor.fromJson(Map<String, dynamic> json) => OrderLabor(
        id: json['id'] as int,
        description: json['description'] as String,
        hours: json['hours'].toString(),
        hourlyRate: json['hourlyRate'].toString(),
        amount: json['amount'].toString(),
      );
}

/// Refacción usada en una orden, con el precio y el nombre que tenía al agregarla.
class OrderPart {
  const OrderPart({
    required this.id,
    required this.partId,
    required this.code,
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.amount,
  });

  final int id;
  final int partId;
  final String code;
  final String name;
  final int quantity;
  final String unitPrice;
  final String amount;

  factory OrderPart.fromJson(Map<String, dynamic> json) => OrderPart(
        id: json['id'] as int,
        partId: json['partId'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        unitPrice: json['unitPrice'].toString(),
        amount: json['amount'].toString(),
      );
}

/// Registro de un cambio de estado de la orden.
class OrderHistoryEntry {
  const OrderHistoryEntry({
    required this.toStatus,
    required this.changedBy,
    required this.changedAt,
    this.fromStatus,
    this.reason,
  });

  final String? fromStatus;
  final String toStatus;
  final String changedBy;
  final String? reason;
  final DateTime changedAt;

  factory OrderHistoryEntry.fromJson(Map<String, dynamic> json) => OrderHistoryEntry(
        fromStatus: json['fromStatus'] as String?,
        toStatus: json['toStatus'] as String,
        changedBy: (json['changedBy'] as Map<String, dynamic>)['name'] as String,
        reason: json['reason'] as String?,
        changedAt: DateTime.parse(json['changedAt'] as String).toLocal(),
      );
}

/// Mecánico disponible para asignar a una orden.
class Mechanic {
  const Mechanic({required this.id, required this.name});

  final int id;
  final String name;

  factory Mechanic.fromJson(Map<String, dynamic> json) => Mechanic(id: json['id'] as int, name: json['name'] as String);
}

/// Orden de servicio. En los listados `services`, `labor`, `parts` e `history` vienen vacíos.
class ServiceOrder {
  const ServiceOrder({
    required this.id,
    required this.folio,
    required this.status,
    required this.clientId,
    required this.vehicleId,
    required this.mechanicId,
    required this.entryMileage,
    required this.reportedProblem,
    required this.total,
    required this.createdAt,
    required this.clientName,
    required this.vehicleTitle,
    required this.licensePlate,
    required this.mechanicName,
    this.appointmentId,
    this.diagnosis,
    this.notes,
    this.recommendations,
    this.cancellationReason,
    this.deliveredAt,
    this.services = const [],
    this.labor = const [],
    this.parts = const [],
    this.serviceMileage,
    this.history = const [],
    this.allowedTransitions = const [],
  });

  final int id;
  final String folio;

  /// RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION, TERMINADO, ENTREGADO o CANCELADA.
  final String status;
  final int? appointmentId;
  final int clientId;
  final int vehicleId;
  final int mechanicId;
  final int entryMileage;
  final String reportedProblem;
  final String? diagnosis;
  final String? notes;
  final String? recommendations;
  final String? cancellationReason;
  final DateTime? deliveredAt;
  final String total;
  final DateTime createdAt;
  final String clientName;
  final String vehicleTitle;
  final String licensePlate;
  final String mechanicName;
  final List<OrderService> services;
  final List<OrderLabor> labor;
  final List<OrderPart> parts;

  /// Kilometraje al que se realizó el servicio (opcional).
  final int? serviceMileage;
  final List<OrderHistoryEntry> history;

  /// Estados a los que el usuario actual puede pasar la orden ahora mismo.
  final List<String> allowedTransitions;

  /// Una orden "en curso" admite documentar el trabajo.
  bool get isOpen => const ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'].contains(status);

  bool get isFinal => status == 'ENTREGADO' || status == 'CANCELADA';

  /// Una orden terminada o entregada admite programar el próximo mantenimiento.
  bool get isCompleted => status == 'TERMINADO' || status == 'ENTREGADO';

  factory ServiceOrder.fromJson(Map<String, dynamic> json) {
    final cliente = json['client'] as Map<String, dynamic>;
    final vehiculo = json['vehicle'] as Map<String, dynamic>;
    final mecanico = json['mechanic'] as Map<String, dynamic>;
    List<T> lista<T>(String clave, T Function(Map<String, dynamic>) f) =>
        ((json[clave] as List?) ?? const []).map((e) => f(e as Map<String, dynamic>)).toList();

    return ServiceOrder(
      id: json['id'] as int,
      folio: json['folio'] as String,
      status: json['status'] as String,
      appointmentId: json['appointmentId'] as int?,
      clientId: json['clientId'] as int,
      vehicleId: json['vehicleId'] as int,
      mechanicId: json['mechanicId'] as int,
      entryMileage: json['entryMileage'] as int,
      reportedProblem: json['reportedProblem'] as String,
      diagnosis: json['diagnosis'] as String?,
      notes: json['notes'] as String?,
      recommendations: json['recommendations'] as String?,
      cancellationReason: json['cancellationReason'] as String?,
      deliveredAt: json['deliveredAt'] == null ? null : DateTime.parse(json['deliveredAt'] as String).toLocal(),
      total: json['total'].toString(),
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      clientName: cliente['name'] as String,
      vehicleTitle: '${vehiculo['brand']} ${vehiculo['model']} ${vehiculo['year']}',
      licensePlate: vehiculo['licensePlate'] as String,
      mechanicName: mecanico['name'] as String,
      services: lista('services', OrderService.fromJson),
      labor: lista('labor', OrderLabor.fromJson),
      parts: lista('parts', OrderPart.fromJson),
      serviceMileage: json['serviceMileage'] as int?,
      history: lista('history', OrderHistoryEntry.fromJson),
      allowedTransitions: ((json['allowedTransitions'] as List?) ?? const []).cast<String>(),
    );
  }
}
