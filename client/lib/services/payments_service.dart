import '../models/paged_result.dart';
import '../models/payment.dart';
import 'api_client.dart';

/// Página del listado de pagos con el total aprobado de los que cumplen el filtro.
class PaymentsPage {
  const PaymentsPage({required this.result, required this.approvedTotal});

  final PagedResult<Payment> result;
  final double approvedTotal;
}

/// Llamadas a los pagos (`/api/orders/:id/payments` y `/api/payments`): administración y recepción.
class PaymentsService {
  PaymentsService(this._api);

  final ApiClient _api;

  PaymentResult _result(ApiResponse r) => PaymentResult.fromJson(r.data as Map<String, dynamic>);

  Future<OrderPayments> forOrder(int orderId) async {
    final ApiResponse r = await _api.get('/orders/$orderId/payments');
    return OrderPayments.fromJson(r.data as Map<String, dynamic>);
  }

  /// Registra un pago en efectivo, tarjeta o transferencia (queda aprobado al instante).
  /// [receivedAmount] solo aplica a efectivo y sirve para calcular el cambio.
  Future<PaymentResult> register(
    int orderId, {
    required PaymentMethod method,
    required double amount,
    String? reference,
    double? receivedAmount,
  }) async =>
      _result(await _api.post(
        '/orders/$orderId/payments',
        body: <String, dynamic>{
          'method': method.apiValue,
          'amount': amount,
          'reference': ?reference,
          'receivedAmount': ?receivedAmount,
        },
      ));

  /// Crea un cobro de Mercado Pago pendiente con su enlace de pago. [amount] por omisión es el saldo disponible.
  Future<PaymentResult> createMercadoPago(int orderId, {double? amount}) async => _result(await _api.post(
        '/orders/$orderId/payments/mercado-pago',
        body: <String, dynamic>{'amount': ?amount},
      ));

  /// Consulta a Mercado Pago el resultado de un cobro pendiente y lo aplica.
  Future<PaymentResult> refresh(int id) async => _result(await _api.post('/payments/$id/refresh'));

  Future<PaymentsPage> list({
    String? search,
    PaymentStatus? status,
    PaymentMethod? method,
    String? from,
    String? to,
    int page = 1,
    int pageSize = 20,
  }) async {
    final ApiResponse r = await _api.get(
      '/payments',
      query: <String, dynamic>{
        'search': search,
        'status': status?.apiValue,
        'method': method?.apiValue,
        'from': from,
        'to': to,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PaymentsPage(
      result: PagedResult<Payment>(
        items: (r.data as List<dynamic>)
            .map((dynamic p) => Payment.fromJson(p as Map<String, dynamic>))
            .toList(),
        total: (meta['total'] as int?) ?? 0,
        page: (meta['page'] as int?) ?? page,
        pageSize: (meta['pageSize'] as int?) ?? pageSize,
      ),
      approvedTotal: ((meta['approvedTotal'] as num?) ?? 0).toDouble(),
    );
  }

  /// Cancela un pago pendiente y libera el importe que reservaba.
  Future<PaymentResult> cancel(int id) async => _result(await _api.post('/payments/$id/cancel'));

  /// Anula un pago aprobado con su motivo (solo administración).
  Future<PaymentResult> voidPayment(int id, String reason) async =>
      _result(await _api.post('/payments/$id/void', body: <String, dynamic>{'reason': reason}));
}
