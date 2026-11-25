import 'service_order.dart';

/// Texto del estado de cobro que ve el cliente en el ticket.
String collectionStatusLabel(String estado) => switch (estado) {
      'SIN_COBRO' => 'Sin cobro',
      'SIN_PAGOS' => 'Pendiente',
      'PARCIAL' => 'Pago parcial',
      'PAGADA' => 'Pagado',
      _ => estado,
    };

/// Próximo servicio del ticket (Sprint 7): el tipo más cercano con su fecha y su kilometraje.
class NextService {
  const NextService({required this.name, this.date, this.mileage});

  final String name;

  /// Fecha 'AAAA-MM-DD' (nula si el tipo solo tiene intervalo en kilómetros).
  final String? date;
  final int? mileage;

  /// «Cambio de aceite · 24/05/2027 · 45,000 km».
  String get label {
    String miles(int n) => n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
    return [
      name,
      if (date != null) date!.split('-').reversed.join('/'),
      if (mileage != null) '${miles(mileage!)} km',
    ].join(' · ');
  }

  factory NextService.fromJson(Map<String, dynamic> json) =>
      NextService(name: json['name'] as String, date: json['date'] as String?, mileage: json['mileage'] as int?);
}

/// Ticket de servicio: su contenido se arma en el servidor con los datos vigentes de la orden y sus pagos.
class Ticket {
  const Ticket({
    required this.id,
    required this.folio,
    required this.generatedAt,
    required this.workshopName,
    required this.workshopAddress,
    required this.workshopPhone,
    required this.orderFolio,
    required this.clientName,
    required this.vehicleDescription,
    required this.licensePlate,
    required this.mileage,
    required this.subtotal,
    required this.total,
    required this.paymentMethods,
    required this.paymentStatus,
    required this.paid,
    required this.balance,
    this.clientPhone,
    this.services = const [],
    this.labor = const [],
    this.parts = const [],
    this.nextService,
  });

  final int id;
  final String folio;
  final DateTime generatedAt;
  final String workshopName;
  final String workshopAddress;
  final String workshopPhone;
  final String orderFolio;
  final String clientName;
  final String? clientPhone;
  final String vehicleDescription;
  final String licensePlate;
  final int mileage;
  final List<OrderService> services;
  final List<OrderLabor> labor;
  final List<OrderPart> parts;
  final NextService? nextService;
  final String subtotal;
  final String total;
  final List<String> paymentMethods;

  /// SIN_COBRO, SIN_PAGOS, PARCIAL o PAGADA.
  final String paymentStatus;
  final String paid;
  final String balance;

  factory Ticket.fromJson(Map<String, dynamic> json) {
    final taller = json['workshop'] as Map<String, dynamic>;
    final orden = json['order'] as Map<String, dynamic>;
    final cliente = json['client'] as Map<String, dynamic>;
    final vehiculo = json['vehicle'] as Map<String, dynamic>;
    final pago = json['payment'] as Map<String, dynamic>;
    List<T> lista<T>(String clave, T Function(Map<String, dynamic>) f) =>
        ((json[clave] as List?) ?? const []).map((e) => f(e as Map<String, dynamic>)).toList();

    return Ticket(
      id: json['id'] as int,
      folio: json['folio'] as String,
      generatedAt: DateTime.parse(json['generatedAt'] as String).toLocal(),
      workshopName: taller['name'] as String,
      workshopAddress: taller['address'] as String,
      workshopPhone: taller['phone'] as String,
      orderFolio: orden['folio'] as String,
      clientName: cliente['name'] as String,
      clientPhone: cliente['phone'] as String?,
      vehicleDescription: vehiculo['description'] as String,
      licensePlate: vehiculo['licensePlate'] as String,
      mileage: vehiculo['mileage'] as int,
      // Las líneas del ticket no traen identificador; se les asigna uno local para reutilizar los modelos de la orden.
      services: lista('services', (e) => OrderService.fromJson({'id': 0, ...e})),
      labor: lista('labor', (e) => OrderLabor.fromJson({'id': 0, ...e})),
      parts: lista('parts', (e) => OrderPart.fromJson({'id': 0, 'partId': 0, 'code': '', ...e})),
      nextService: json['nextService'] == null ? null : NextService.fromJson(json['nextService'] as Map<String, dynamic>),
      subtotal: json['subtotal'].toString(),
      total: json['total'].toString(),
      paymentMethods: ((pago['methods'] as List?) ?? const []).cast<String>(),
      paymentStatus: pago['status'] as String,
      paid: pago['paid'].toString(),
      balance: pago['balance'].toString(),
    );
  }
}
