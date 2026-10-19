import 'package:flutter/foundation.dart';

import '../models/payment.dart';
import '../models/ticket.dart';
import '../services/api_client.dart';

/// Operaciones de pagos y tickets de una orden. No guarda listados: cada pantalla consulta lo que necesita.
class PaymentsProvider extends ChangeNotifier {
  PaymentsProvider(this.api);

  final ApiClient api;

  /// Vacía el estado al terminar la sesión (no hay datos persistentes, solo se notifica).
  void reset() => notifyListeners();

  PaymentsData _datos(dynamic respuesta) => PaymentsData.fromJson((respuesta as Map<String, dynamic>)['data'] as Map<String, dynamic>);

  Future<PaymentsData> list(int orderId) async => _datos(await api.get('/orders/$orderId/payments'));

  /// Registra un pago. Con Mercado Pago el pago queda Pendiente y trae el enlace de pago.
  Future<({Payment payment, PaymentSummary summary})> create(int orderId, {required String method, required double amount, String? reference}) async {
    final respuesta = await api.post('/orders/$orderId/payments', body: {
      'method': method,
      'amount': amount,
      if (reference != null && reference.trim().isNotEmpty) 'reference': reference.trim(),
    }) as Map<String, dynamic>;
    final datos = respuesta['data'] as Map<String, dynamic>;
    return (
      payment: Payment.fromJson(datos['payment'] as Map<String, dynamic>),
      summary: PaymentSummary.fromJson(datos['summary'] as Map<String, dynamic>),
    );
  }

  /// Consulta a Mercado Pago el estado real de un pago Pendiente.
  Future<Payment> sync(int paymentId) async {
    final respuesta = await api.post('/payments/$paymentId/sync') as Map<String, dynamic>;
    return Payment.fromJson((respuesta['data'] as Map<String, dynamic>)['payment'] as Map<String, dynamic>);
  }

  Future<Payment> cancel(int paymentId) async {
    final respuesta = await api.post('/payments/$paymentId/cancel') as Map<String, dynamic>;
    return Payment.fromJson((respuesta['data'] as Map<String, dynamic>)['payment'] as Map<String, dynamic>);
  }

  // ---- Ticket

  /// Genera el ticket de la orden o devuelve el que ya existe (un solo folio por orden).
  Future<Ticket> generateTicket(int orderId) async {
    final respuesta = await api.post('/orders/$orderId/ticket') as Map<String, dynamic>;
    return Ticket.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  /// Dirección de corta vida para abrir el ticket imprimible en el navegador del sistema.
  Future<Uri> printLink(int orderId) async {
    final respuesta = await api.post('/orders/$orderId/ticket/print-link') as Map<String, dynamic>;
    return Uri.parse((respuesta['data'] as Map<String, dynamic>)['url'] as String);
  }
}
