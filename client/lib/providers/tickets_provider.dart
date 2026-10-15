import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/ticket.dart';
import '../services/tickets_service.dart';

/// Estado del ticket abierto en pantalla y operación de generarlo desde una orden.
class TicketsProvider extends ChangeNotifier {
  TicketsProvider(this._service);

  final TicketsService _service;

  Ticket? _ticket;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  Ticket? get ticket => _ticket;
  bool get loading => _loading;
  String? get error => _error;

  /// Genera el ticket de la orden (o recupera el existente). Lanza [ApiError] si la orden no está lista.
  Future<TicketResult> generate(int orderId) => _service.generate(orderId);

  /// Carga el ticket con los pagos vigentes.
  Future<void> load(int id) async {
    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    _ticket = null;
    notifyListeners();
    try {
      final Ticket datos = await _service.get(id);
      if (solicitud != _requestId) return;
      _ticket = datos;
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
