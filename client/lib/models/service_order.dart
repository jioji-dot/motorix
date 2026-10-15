import 'order_status.dart';
import 'payment.dart';

/// Servicio realizado dentro de una orden.
class OrderServiceLine {
  const OrderServiceLine({required this.id, required this.description, required this.amount});

  final int id;
  final String description;
  final double amount;

  factory OrderServiceLine.fromJson(Map<String, dynamic> json) => OrderServiceLine(
        id: json['id'] as int,
        description: json['description'] as String,
        amount: (json['amount'] as num).toDouble(),
      );
}

/// Línea de mano de obra de una orden.
class OrderLaborLine {
  const OrderLaborLine({
    required this.id,
    required this.description,
    required this.hours,
    required this.hourlyRate,
    required this.amount,
  });

  final int id;
  final String description;
  final double hours;
  final double hourlyRate;
  final double amount;

  factory OrderLaborLine.fromJson(Map<String, dynamic> json) => OrderLaborLine(
        id: json['id'] as int,
        description: json['description'] as String,
        hours: (json['hours'] as num).toDouble(),
        hourlyRate: (json['hourlyRate'] as num).toDouble(),
        amount: (json['amount'] as num).toDouble(),
      );
}

/// Refacción utilizada en una orden, con el precio unitario vigente al agregarla.
class OrderPartLine {
  const OrderPartLine({
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
  final double unitPrice;
  final double amount;

  factory OrderPartLine.fromJson(Map<String, dynamic> json) => OrderPartLine(
        id: json['id'] as int,
        partId: json['partId'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        unitPrice: (json['unitPrice'] as num).toDouble(),
        amount: (json['amount'] as num).toDouble(),
      );
}

/// Cambio de estado registrado en el historial de la orden.
class StatusChange {
  const StatusChange({
    required this.toStatus,
    required this.changedByName,
    required this.createdAt,
    this.fromStatus,
  });

  final OrderStatus? fromStatus;
  final OrderStatus toStatus;
  final String changedByName;
  final DateTime? createdAt;

  factory StatusChange.fromJson(Map<String, dynamic> json) => StatusChange(
        fromStatus: json['fromStatus'] == null ? null : OrderStatus.fromApi(json['fromStatus'] as String),
        toStatus: OrderStatus.fromApi(json['toStatus'] as String),
        changedByName: ((json['changedBy'] as Map<String, dynamic>?)?['name'] as String?) ?? '—',
        createdAt: json['createdAt'] == null ? null : DateTime.tryParse(json['createdAt'] as String),
      );
}

/// Qué partes de la orden puede editar el usuario actual (calculado por el servidor).
class OrderEditable {
  const OrderEditable({
    this.work = false,
    this.notesAndRecommendations = false,
    this.basicData = false,
    this.parts = false,
  });

  final bool work;
  final bool notesAndRecommendations;
  final bool basicData;

  /// Puede agregar, cambiar o quitar refacciones de la orden.
  final bool parts;

  factory OrderEditable.fromJson(Map<String, dynamic>? json) => OrderEditable(
        work: (json?['work'] as bool?) ?? false,
        notesAndRecommendations: (json?['notesAndRecommendations'] as bool?) ?? false,
        basicData: (json?['basicData'] as bool?) ?? false,
        parts: (json?['parts'] as bool?) ?? false,
      );
}

/// Orden de servicio. En los listados solo vienen los datos de resumen; el detalle agrega el resto.
class ServiceOrder {
  const ServiceOrder({
    required this.id,
    required this.folio,
    required this.clientId,
    required this.clientName,
    required this.vehicleId,
    required this.vehiclePlate,
    required this.vehicleTitle,
    required this.entryMileage,
    required this.reportedProblem,
    required this.status,
    required this.total,
    this.mechanicId,
    this.mechanicName,
    this.appointmentId,
    this.createdAt,
    this.diagnosis,
    this.notes,
    this.recommendations,
    this.services = const <OrderServiceLine>[],
    this.labor = const <OrderLaborLine>[],
    this.parts = const <OrderPartLine>[],
    this.serviceMileage,
    this.payment,
    this.paymentStatus,
    this.ticketId,
    this.servicesSubtotal = 0,
    this.laborSubtotal = 0,
    this.partsSubtotal = 0,
    this.statusHistory = const <StatusChange>[],
    this.allowedTransitions = const <OrderStatus>[],
    this.editable = const OrderEditable(),
  });

  final int id;
  final String folio;
  final int clientId;
  final String clientName;
  final int vehicleId;
  final String vehiclePlate;
  final String vehicleTitle;
  final int? mechanicId;
  final String? mechanicName;
  final int entryMileage;
  final String reportedProblem;
  final OrderStatus status;
  final int? appointmentId;
  final double total;
  final DateTime? createdAt;

  final String? diagnosis;
  final String? notes;
  final String? recommendations;
  final List<OrderServiceLine> services;
  final List<OrderLaborLine> labor;
  final List<OrderPartLine> parts;

  /// Kilometraje con el que termina el servicio (opcional).
  final int? serviceMileage;

  /// Resumen de pago (solo administración y recepción; el mecánico recibe null).
  final PaymentSummary? payment;

  /// Estado de pago de la orden (null para el mecánico).
  final OrderPaymentStatus? paymentStatus;
  final int? ticketId;
  final double servicesSubtotal;
  final double laborSubtotal;
  final double partsSubtotal;
  final List<StatusChange> statusHistory;
  final List<OrderStatus> allowedTransitions;
  final OrderEditable editable;

  factory ServiceOrder.fromJson(Map<String, dynamic> json) => ServiceOrder(
        id: json['id'] as int,
        folio: (json['folio'] as String?) ?? '',
        clientId: json['clientId'] as int,
        clientName: json['clientName'] as String,
        vehicleId: json['vehicleId'] as int,
        vehiclePlate: json['vehiclePlate'] as String,
        vehicleTitle: json['vehicleTitle'] as String,
        mechanicId: json['mechanicId'] as int?,
        mechanicName: json['mechanicName'] as String?,
        entryMileage: json['entryMileage'] as int,
        reportedProblem: json['reportedProblem'] as String,
        status: OrderStatus.fromApi(json['status'] as String),
        appointmentId: json['appointmentId'] as int?,
        total: ((json['total'] as num?) ?? 0).toDouble(),
        createdAt: json['createdAt'] == null ? null : DateTime.tryParse(json['createdAt'] as String),
        diagnosis: json['diagnosis'] as String?,
        notes: json['notes'] as String?,
        recommendations: json['recommendations'] as String?,
        services: ((json['services'] as List<dynamic>?) ?? <dynamic>[])
            .map((dynamic s) => OrderServiceLine.fromJson(s as Map<String, dynamic>))
            .toList(),
        labor: ((json['labor'] as List<dynamic>?) ?? <dynamic>[])
            .map((dynamic l) => OrderLaborLine.fromJson(l as Map<String, dynamic>))
            .toList(),
        parts: ((json['parts'] as List<dynamic>?) ?? <dynamic>[])
            .map((dynamic p) => OrderPartLine.fromJson(p as Map<String, dynamic>))
            .toList(),
        serviceMileage: json['serviceMileage'] as int?,
        payment: _paymentFrom(json['payment']),
        paymentStatus: json['paymentStatus'] != null
            ? OrderPaymentStatus.fromApi(json['paymentStatus'] as String)
            : _paymentFrom(json['payment'])?.status,
        ticketId: json['ticketId'] as int?,
        servicesSubtotal: ((json['servicesSubtotal'] as num?) ?? 0).toDouble(),
        laborSubtotal: ((json['laborSubtotal'] as num?) ?? 0).toDouble(),
        partsSubtotal: ((json['partsSubtotal'] as num?) ?? 0).toDouble(),
        statusHistory: ((json['statusHistory'] as List<dynamic>?) ?? <dynamic>[])
            .map((dynamic h) => StatusChange.fromJson(h as Map<String, dynamic>))
            .toList(),
        allowedTransitions: ((json['allowedTransitions'] as List<dynamic>?) ?? <dynamic>[])
            .map((dynamic e) => OrderStatus.fromApi(e as String))
            .toList(),
        editable: OrderEditable.fromJson(json['editable'] as Map<String, dynamic>?),
      );
}

/// Servicio realizado capturado en el formulario.
class ServiceInput {
  const ServiceInput({required this.description, required this.amount});

  final String description;
  final double amount;

  Map<String, dynamic> toJson() => <String, dynamic>{'description': description, 'amount': amount};
}

/// Línea de mano de obra capturada en el formulario.
class LaborInput {
  const LaborInput({required this.description, required this.hours, required this.hourlyRate});

  final String description;
  final double hours;
  final double hourlyRate;

  /// Importe calculado igual que el servidor: horas por tarifa, redondeado a dos decimales.
  double get amount => (hours * hourlyRate * 100).roundToDouble() / 100;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'description': description,
        'hours': hours,
        'hourlyRate': hourlyRate,
      };
}

/// Mecánico activo disponible para asignar órdenes.
class MechanicOption {
  const MechanicOption({required this.id, required this.name, required this.username});

  final int id;
  final String name;
  final String username;

  factory MechanicOption.fromJson(Map<String, dynamic> json) => MechanicOption(
        id: json['id'] as int,
        name: json['name'] as String,
        username: json['username'] as String,
      );
}

/// Corrección de datos básicos de una orden. Solo se envían los campos que cambian.
class OrderBasicsChanges {
  const OrderBasicsChanges({
    this.reportedProblem,
    this.mechanicId,
    this.clearMechanic = false,
    this.entryMileage,
    this.mileageCorrection = false,
  });

  final String? reportedProblem;
  final int? mechanicId;

  /// Quitar al mecánico asignado (solo válido en una orden recibida).
  final bool clearMechanic;
  final int? entryMileage;
  final bool mileageCorrection;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'reportedProblem': ?reportedProblem,
        if (clearMechanic) 'mechanicId': null else 'mechanicId': ?mechanicId,
        'entryMileage': ?entryMileage,
        if (mileageCorrection) 'mileageCorrection': true,
      };
}

/// Datos capturados al crear una orden.
class NewOrderInput {
  const NewOrderInput({
    this.clientId,
    this.vehicleId,
    this.appointmentId,
    required this.entryMileage,
    this.reportedProblem,
    this.mechanicId,
    this.mileageCorrection = false,
  });

  final int? clientId;
  final int? vehicleId;
  final int? appointmentId;
  final int entryMileage;
  final String? reportedProblem;
  final int? mechanicId;
  final bool mileageCorrection;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'clientId': ?clientId,
        'vehicleId': ?vehicleId,
        'appointmentId': ?appointmentId,
        'entryMileage': entryMileage,
        'reportedProblem': ?reportedProblem,
        'mechanicId': ?mechanicId,
        if (mileageCorrection) 'mileageCorrection': true,
      };
}

PaymentSummary? _paymentFrom(dynamic json) =>
    json == null ? null : PaymentSummary.fromJson(json as Map<String, dynamic>);
