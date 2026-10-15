import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Método de pago. Efectivo, tarjeta y transferencia se cobran en el taller; Mercado Pago es digital.
enum PaymentMethod {
  cash('CASH', 'Efectivo'),
  card('CARD', 'Tarjeta'),
  transfer('TRANSFER', 'Transferencia'),
  mercadoPago('MERCADO_PAGO', 'Mercado Pago');

  const PaymentMethod(this.apiValue, this.label);

  final String apiValue;
  final String label;

  /// Se cobra en el taller y queda aprobado al registrarse.
  bool get isManual => this != mercadoPago;

  static PaymentMethod fromApi(String valor) =>
      PaymentMethod.values.firstWhere((PaymentMethod m) => m.apiValue == valor, orElse: () => cash);
}

/// Estado de un pago. Los colores siguen `docs/design-system.md`.
enum PaymentStatus {
  pending('PENDIENTE', 'Pendiente', AppColors.warning),
  approved('APROBADO', 'Aprobado', AppColors.success),
  rejected('RECHAZADO', 'Rechazado', AppColors.danger),
  cancelled('CANCELADO', 'Cancelado', AppColors.textSecondary),
  voided('ANULADO', 'Anulado', AppColors.danger);

  const PaymentStatus(this.apiValue, this.label, this.color);

  final String apiValue;
  final String label;
  final Color color;

  static PaymentStatus fromApi(String valor) =>
      PaymentStatus.values.firstWhere((PaymentStatus s) => s.apiValue == valor, orElse: () => pending);
}

/// Estado de pago de una orden (calculado por el servidor).
enum OrderPaymentStatus {
  noCharge('NO_CHARGE', 'Sin cobro', AppColors.textSecondary),
  unpaid('UNPAID', 'Sin pagar', AppColors.danger),
  partial('PARTIAL', 'Pago parcial', AppColors.warning),
  paid('PAID', 'Pagada', AppColors.success);

  const OrderPaymentStatus(this.apiValue, this.label, this.color);

  final String apiValue;
  final String label;
  final Color color;

  static OrderPaymentStatus fromApi(String valor) => OrderPaymentStatus.values
      .firstWhere((OrderPaymentStatus s) => s.apiValue == valor, orElse: () => unpaid);
}

/// Total, pagado y saldo de una orden.
class PaymentSummary {
  const PaymentSummary({
    required this.total,
    required this.paid,
    required this.pending,
    required this.balance,
    required this.available,
    required this.status,
  });

  final double total;
  final double paid;

  /// Importe reservado por cobros de Mercado Pago pendientes.
  final double pending;

  /// Lo que falta por cobrar (`total − paid`).
  final double balance;

  /// Lo que aún se puede registrar o cobrar (`total − paid − pending`).
  final double available;
  final OrderPaymentStatus status;

  /// Se pueden registrar pagos: hay cobro y queda saldo disponible.
  bool get canCharge => status != OrderPaymentStatus.noCharge && available > 0;

  factory PaymentSummary.fromJson(Map<String, dynamic> json) => PaymentSummary(
        total: (json['total'] as num).toDouble(),
        paid: (json['paid'] as num).toDouble(),
        pending: (json['pending'] as num).toDouble(),
        balance: (json['balance'] as num).toDouble(),
        available: (json['available'] as num).toDouble(),
        status: OrderPaymentStatus.fromApi(json['status'] as String),
      );
}

/// Pago de una orden. Las acciones (`canCancel`, `canVoid`, `canRefresh`) las calcula el servidor.
class Payment {
  const Payment({
    required this.id,
    required this.orderId,
    required this.orderFolio,
    required this.clientName,
    required this.vehiclePlate,
    required this.method,
    required this.amount,
    required this.status,
    required this.createdByName,
    required this.createdAt,
    required this.canCancel,
    required this.canVoid,
    required this.canRefresh,
    this.reference,
    this.externalReference,
    this.paymentUrl,
    this.voidReason,
    this.voidedByName,
    this.voidedAt,
  });

  final int id;
  final int orderId;
  final String orderFolio;
  final String clientName;
  final String vehiclePlate;
  final PaymentMethod method;
  final double amount;
  final PaymentStatus status;
  final String? reference;
  final String? externalReference;
  final String? paymentUrl;
  final String? voidReason;
  final String? voidedByName;
  final DateTime? voidedAt;
  final String createdByName;
  final DateTime? createdAt;
  final bool canCancel;
  final bool canVoid;
  final bool canRefresh;

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'] as int,
        orderId: json['orderId'] as int,
        orderFolio: (json['orderFolio'] as String?) ?? '',
        clientName: (json['clientName'] as String?) ?? '',
        vehiclePlate: (json['vehiclePlate'] as String?) ?? '',
        method: PaymentMethod.fromApi(json['method'] as String),
        amount: (json['amount'] as num).toDouble(),
        status: PaymentStatus.fromApi(json['status'] as String),
        reference: json['reference'] as String?,
        externalReference: json['externalReference'] as String?,
        paymentUrl: json['paymentUrl'] as String?,
        voidReason: json['voidReason'] as String?,
        voidedByName: json['voidedByName'] as String?,
        voidedAt: json['voidedAt'] == null ? null : DateTime.tryParse(json['voidedAt'] as String),
        createdByName: (json['createdByName'] as String?) ?? '',
        createdAt: json['createdAt'] == null ? null : DateTime.tryParse(json['createdAt'] as String),
        canCancel: (json['canCancel'] as bool?) ?? false,
        canVoid: (json['canVoid'] as bool?) ?? false,
        canRefresh: (json['canRefresh'] as bool?) ?? false,
      );
}

/// Pagos de una orden junto con su resumen de saldo.
class OrderPayments {
  const OrderPayments({required this.summary, required this.payments});

  final PaymentSummary summary;
  final List<Payment> payments;

  factory OrderPayments.fromJson(Map<String, dynamic> json) => OrderPayments(
        summary: PaymentSummary.fromJson(json['summary'] as Map<String, dynamic>),
        payments: (json['payments'] as List<dynamic>)
            .map((dynamic p) => Payment.fromJson(p as Map<String, dynamic>))
            .toList(),
      );
}

/// Resultado de registrar, cancelar, anular o actualizar un pago.
class PaymentResult {
  const PaymentResult({required this.payment, required this.summary, this.change});

  final Payment payment;
  final PaymentSummary summary;

  /// Cambio calculado al cobrar en efectivo con importe recibido (no se guarda).
  final double? change;

  factory PaymentResult.fromJson(Map<String, dynamic> json) => PaymentResult(
        payment: Payment.fromJson(json['payment'] as Map<String, dynamic>),
        summary: PaymentSummary.fromJson(json['summary'] as Map<String, dynamic>),
        change: (json['change'] as num?)?.toDouble(),
      );
}
