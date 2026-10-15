import '../models/ticket.dart';
import 'api_client.dart';

/// Llamadas a los tickets (`/api/orders/:id/ticket` y `/api/tickets/:id`): administración y recepción.
class TicketsService {
  TicketsService(this._api);

  final ApiClient _api;

  /// Genera el ticket de la orden o devuelve el existente (201 al crearlo, 200 si ya existía).
  Future<TicketResult> generate(int orderId) async {
    final ApiResponse r = await _api.post('/orders/$orderId/ticket');
    return TicketResult(
      ticket: Ticket.fromJson(r.data as Map<String, dynamic>),
      created: r.statusCode == 201,
    );
  }

  Future<Ticket> get(int id) async {
    final ApiResponse r = await _api.get('/tickets/$id');
    return Ticket.fromJson(r.data as Map<String, dynamic>);
  }
}
