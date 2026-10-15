import 'order_status.dart';
import 'payment.dart';

DateTime? _fecha(dynamic valor) => valor == null ? null : DateTime.tryParse(valor as String);

/// Datos del taller impresos en el ticket.
class TicketWorkshop {
  const TicketWorkshop({required this.name, required this.address, required this.phone});

  final String name;
  final String address;
  final String phone;

  factory TicketWorkshop.fromJson(Map<String, dynamic> json) => TicketWorkshop(
        name: json['name'] as String,
        address: json['address'] as String,
        phone: json['phone'] as String,
      );
}

class TicketServiceLine {
  const TicketServiceLine({required this.description, required this.amount});

  final String description;
  final double amount;

  factory TicketServiceLine.fromJson(Map<String, dynamic> json) => TicketServiceLine(
        description: json['description'] as String,
        amount: (json['amount'] as num).toDouble(),
      );
}

class TicketLaborLine {
  const TicketLaborLine({
    required this.description,
    required this.hours,
    required this.hourlyRate,
    required this.amount,
  });

  final String description;
  final double hours;
  final double hourlyRate;
  final double amount;

  factory TicketLaborLine.fromJson(Map<String, dynamic> json) => TicketLaborLine(
        description: json['description'] as String,
        hours: (json['hours'] as num).toDouble(),
        hourlyRate: (json['hourlyRate'] as num).toDouble(),
        amount: (json['amount'] as num).toDouble(),
      );
}

class TicketPartLine {
  const TicketPartLine({
    required this.code,
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.amount,
  });

  final String code;
  final String name;
  final int quantity;
  final double unitPrice;
  final double amount;

  factory TicketPartLine.fromJson(Map<String, dynamic> json) => TicketPartLine(
        code: json['code'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        unitPrice: (json['unitPrice'] as num).toDouble(),
        amount: (json['amount'] as num).toDouble(),
      );
}

/// Pago que aparece en el comprobante (solo aprobados y pendientes).
class TicketPayment {
  const TicketPayment({
    required this.method,
    required this.amount,
    required this.status,
    this.reference,
    this.createdAt,
  });

  final PaymentMethod method;
  final double amount;
  final PaymentStatus status;
  final String? reference;
  final DateTime? createdAt;

  factory TicketPayment.fromJson(Map<String, dynamic> json) => TicketPayment(
        method: PaymentMethod.fromApi(json['method'] as String),
        amount: (json['amount'] as num).toDouble(),
        status: PaymentStatus.fromApi(json['status'] as String),
        reference: json['reference'] as String?,
        createdAt: _fecha(json['createdAt']),
      );
}

/// Ticket de servicio de una orden terminada o entregada, con los pagos vigentes.
class Ticket {
  const Ticket({
    required this.id,
    required this.folio,
    required this.issuedAt,
    required this.generatedByName,
    required this.workshop,
    required this.orderId,
    required this.orderFolio,
    required this.orderStatus,
    required this.orderCreatedAt,
    required this.deliveredAt,
    required this.clientName,
    required this.clientPhone,
    required this.vehicleBrand,
    required this.vehicleModel,
    required this.licensePlate,
    required this.entryMileage,
    required this.serviceMileage,
    required this.services,
    required this.labor,
    required this.parts,
    required this.servicesSubtotal,
    required this.laborSubtotal,
    required this.partsSubtotal,
    required this.total,
    required this.payments,
    required this.summary,
  });

  final int id;
  final String folio;
  final DateTime? issuedAt;
  final String generatedByName;
  final TicketWorkshop workshop;
  final int orderId;
  final String orderFolio;

  final OrderStatus orderStatus;
  final DateTime? orderCreatedAt;
  final DateTime? deliveredAt;
  final String clientName;
  final String? clientPhone;
  final String vehicleBrand;
  final String vehicleModel;
  final String licensePlate;
  final int entryMileage;
  final int? serviceMileage;
  final List<TicketServiceLine> services;
  final List<TicketLaborLine> labor;
  final List<TicketPartLine> parts;
  final double servicesSubtotal;
  final double laborSubtotal;
  final double partsSubtotal;
  final double total;
  final List<TicketPayment> payments;
  final PaymentSummary summary;

  String get vehicleTitle => '$vehicleBrand $vehicleModel';

  factory Ticket.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> orden = json['order'] as Map<String, dynamic>;
    final Map<String, dynamic> cliente = json['client'] as Map<String, dynamic>;
    final Map<String, dynamic> vehiculo = json['vehicle'] as Map<String, dynamic>;
    final Map<String, dynamic> subtotales = json['subtotals'] as Map<String, dynamic>;
    List<T> lista<T>(String clave, T Function(Map<String, dynamic>) crear) =>
        (json[clave] as List<dynamic>).map((dynamic e) => crear(e as Map<String, dynamic>)).toList();

    return Ticket(
      id: json['id'] as int,
      folio: json['folio'] as String,
      issuedAt: _fecha(json['issuedAt']),
      generatedByName: (json['generatedByName'] as String?) ?? '',
      workshop: TicketWorkshop.fromJson(json['workshop'] as Map<String, dynamic>),
      orderId: orden['id'] as int,
      orderFolio: orden['folio'] as String,
      orderStatus: OrderStatus.fromApi(orden['status'] as String),
      orderCreatedAt: _fecha(orden['createdAt']),
      deliveredAt: _fecha(orden['deliveredAt']),
      clientName: cliente['name'] as String,
      clientPhone: cliente['phone'] as String?,
      vehicleBrand: vehiculo['brand'] as String,
      vehicleModel: vehiculo['model'] as String,
      licensePlate: vehiculo['licensePlate'] as String,
      entryMileage: vehiculo['entryMileage'] as int,
      serviceMileage: vehiculo['serviceMileage'] as int?,
      services: lista('services', TicketServiceLine.fromJson),
      labor: lista('labor', TicketLaborLine.fromJson),
      parts: lista('parts', TicketPartLine.fromJson),
      servicesSubtotal: (subtotales['services'] as num).toDouble(),
      laborSubtotal: (subtotales['labor'] as num).toDouble(),
      partsSubtotal: (subtotales['parts'] as num).toDouble(),
      total: (json['total'] as num).toDouble(),
      payments: lista('payments', TicketPayment.fromJson),
      summary: PaymentSummary.fromJson(json['summary'] as Map<String, dynamic>),
    );
  }
}

/// Resultado de generar el ticket: indica si se creó ahora o ya existía.
class TicketResult {
  const TicketResult({required this.ticket, required this.created});

  final Ticket ticket;
  final bool created;
}
