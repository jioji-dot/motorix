import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/paged_result.dart';
import '../models/payment.dart';
import '../services/payments_service.dart';

/// Estado de los pagos: los de la orden abierta y el listado general con filtros y paginación.
class PaymentsProvider extends ChangeNotifier {
  PaymentsProvider(this._service);

  final PaymentsService _service;

  // --- Pagos de la orden abierta en el detalle ---
  OrderPayments? _order;
  bool _orderLoading = false;
  String? _orderError;
  int _orderRequestId = 0;

  OrderPayments? get order => _order;
  bool get orderLoading => _orderLoading;
  String? get orderError => _orderError;

  Future<void> loadForOrder(int orderId) async {
    final int solicitud = ++_orderRequestId;
    _orderLoading = true;
    _orderError = null;
    notifyListeners();
    try {
      final OrderPayments datos = await _service.forOrder(orderId);
      if (solicitud != _orderRequestId) return;
      _order = datos;
    } on ApiError catch (error) {
      if (solicitud != _orderRequestId) return;
      _orderError = error.message;
    } catch (_) {
      if (solicitud != _orderRequestId) return;
      _orderError = 'El servidor respondió con un formato inesperado.';
    } finally {
      if (solicitud == _orderRequestId) {
        _orderLoading = false;
        notifyListeners();
      }
    }
  }

  /// Limpia los pagos de la orden anterior al abrir otra.
  void clearOrder() {
    _order = null;
    _orderError = null;
    _orderRequestId++;
  }

  /// Registra un pago manual. Lanza [ApiError] (por ejemplo `PAYMENT_EXCEEDS_BALANCE`).
  Future<PaymentResult> register(
    int orderId, {
    required PaymentMethod method,
    required double amount,
    String? reference,
    double? receivedAmount,
  }) async {
    final PaymentResult r = await _service.register(
      orderId,
      method: method,
      amount: amount,
      reference: reference,
      receivedAmount: receivedAmount,
    );
    await loadForOrder(orderId);
    return r;
  }

  /// Crea un cobro de Mercado Pago. Lanza [ApiError] (`PAYMENT_PENDING_EXISTS`, `PAYMENT_PROVIDER_UNAVAILABLE`...).
  Future<PaymentResult> createMercadoPago(int orderId, {double? amount}) async {
    final PaymentResult r = await _service.createMercadoPago(orderId, amount: amount);
    await loadForOrder(orderId);
    return r;
  }

  /// Actualiza el estado de un cobro pendiente consultando a Mercado Pago.
  Future<PaymentResult> refresh(int orderId, int paymentId) async {
    final PaymentResult r = await _service.refresh(paymentId);
    await loadForOrder(orderId);
    return r;
  }

  Future<PaymentResult> cancel(int orderId, int paymentId) async {
    final PaymentResult r = await _service.cancel(paymentId);
    await loadForOrder(orderId);
    return r;
  }

  Future<PaymentResult> voidPayment(int orderId, int paymentId, String reason) async {
    final PaymentResult r = await _service.voidPayment(paymentId, reason);
    await loadForOrder(orderId);
    return r;
  }

  // --- Listado general ---
  PagedResult<Payment>? _result;
  double _approvedTotal = 0;
  String _search = '';
  PaymentStatus? _status;
  PaymentMethod? _method;
  String? _from;
  String? _to;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  PagedResult<Payment>? get result => _result;
  double get approvedTotal => _approvedTotal;
  String get search => _search;
  PaymentStatus? get statusFilter => _status;
  PaymentMethod? get methodFilter => _method;
  String? get fromFilter => _from;
  String? get toFilter => _to;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasFilters =>
      _search.isNotEmpty || _status != null || _method != null || _from != null || _to != null;

  /// Carga una página aplicando los filtros. Los que se pasan reemplazan a los anteriores;
  /// use [clearStatus], [clearMethod] o [clearDates] para quitarlos.
  Future<void> load({
    int page = 1,
    String? search,
    PaymentStatus? status,
    bool clearStatus = false,
    PaymentMethod? method,
    bool clearMethod = false,
    String? from,
    String? to,
    bool clearDates = false,
  }) async {
    if (search != null) _search = search.trim();
    if (clearStatus) _status = null;
    if (status != null) _status = status;
    if (clearMethod) _method = null;
    if (method != null) _method = method;
    if (clearDates) {
      _from = null;
      _to = null;
    }
    if (from != null) _from = from;
    if (to != null) _to = to;

    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final PaymentsPage pagina = await _service.list(
        search: _search,
        status: _status,
        method: _method,
        from: _from,
        to: _to,
        page: page,
      );
      if (solicitud != _requestId) return;
      _result = pagina.result;
      _approvedTotal = pagina.approvedTotal;
    } on ApiError catch (error) {
      if (solicitud != _requestId) return;
      _error = error.message;
    } catch (_) {
      if (solicitud != _requestId) return;
      _error = 'El servidor respondió con un formato inesperado.';
    } finally {
      if (solicitud == _requestId) {
        _loading = false;
        notifyListeners();
      }
    }
  }
}
