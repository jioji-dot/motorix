/// Etiqueta en español de un método de pago.
String paymentMethodLabel(String metodo) => switch (metodo) {
      'EFECTIVO' => 'Efectivo',
      'TARJETA' => 'Tarjeta',
      'TRANSFERENCIA' => 'Transferencia',
      'MERCADO_PAGO' => 'Mercado Pago',
      _ => metodo,
    };

/// Texto de los métodos cobrados: "Efectivo", "Efectivo y Tarjeta" o "Efectivo, Tarjeta y Mercado Pago".
String paymentMethodsText(List<String> metodos) {
  final nombres = metodos.map(paymentMethodLabel).toList();
  if (nombres.isEmpty) return 'Sin pagos registrados';
  if (nombres.length == 1) return nombres.first;
  return '${nombres.sublist(0, nombres.length - 1).join(', ')} y ${nombres.last}';
}

/// Pago de una orden. Nunca contiene datos de tarjeta.
class Payment {
  const Payment({
    required this.id,
    required this.orderId,
    required this.amount,
    required this.method,
    required this.status,
    required this.createdByName,
    required this.createdAt,
    this.reference,
    this.paymentLink,
    this.paidAt,
  });

  final int id;
  final int orderId;
  final String amount;

  /// EFECTIVO, TARJETA, TRANSFERENCIA o MERCADO_PAGO.
  final String method;

  /// PENDIENTE, PAGADO, RECHAZADO o CANCELADO.
  final String status;
  final String? reference;

  /// Enlace de pago (solo en los pagos de Mercado Pago).
  final String? paymentLink;
  final DateTime? paidAt;
  final String createdByName;
  final DateTime createdAt;

  bool get isPendingMercadoPago => method == 'MERCADO_PAGO' && status == 'PENDIENTE';

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'] as int,
        orderId: json['orderId'] as int,
        amount: json['amount'].toString(),
        method: json['method'] as String,
        status: json['status'] as String,
        reference: json['reference'] as String?,
        paymentLink: json['paymentLink'] as String?,
        paidAt: json['paidAt'] == null ? null : DateTime.parse(json['paidAt'] as String).toLocal(),
        createdByName: (json['createdBy'] as Map<String, dynamic>)['name'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      );
}

/// Resumen de cobro de una orden.
class PaymentSummary {
  const PaymentSummary({
    required this.total,
    required this.paid,
    required this.pending,
    required this.balance,
    required this.available,
    required this.status,
  });

  final String total;
  final String paid;
  final String pending;

  /// Lo que falta por cobrar (total menos pagado).
  final String balance;

  /// Lo que se puede registrar ahora (saldo menos lo reservado por pagos Pendientes).
  final String available;

  /// SIN_COBRO, SIN_PAGOS, PARCIAL o PAGADA.
  final String status;

  bool get canCharge => double.parse(available) > 0;

  factory PaymentSummary.fromJson(Map<String, dynamic> json) => PaymentSummary(
        total: json['total'].toString(),
        paid: json['paid'].toString(),
        pending: json['pending'].toString(),
        balance: json['balance'].toString(),
        available: json['available'].toString(),
        status: json['status'] as String,
      );
}

/// Pagos de una orden con su resumen.
class PaymentsData {
  const PaymentsData({required this.payments, required this.summary});

  final List<Payment> payments;
  final PaymentSummary summary;

  factory PaymentsData.fromJson(Map<String, dynamic> json) => PaymentsData(
        payments: ((json['payments'] as List?) ?? const []).map((p) => Payment.fromJson(p as Map<String, dynamic>)).toList(),
        summary: PaymentSummary.fromJson(json['summary'] as Map<String, dynamic>),
      );
}
