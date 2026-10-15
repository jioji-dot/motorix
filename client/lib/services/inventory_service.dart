import '../models/paged_result.dart';
import '../models/part.dart';
import 'api_client.dart';

/// Llamadas a `/api/parts` (catálogo e inventario; solo administración).
class InventoryService {
  InventoryService(this._api);

  final ApiClient _api;

  Future<PagedResult<Part>> list({
    String? search,
    bool? active,
    AlertFilter? alert,
    int page = 1,
    int pageSize = 20,
  }) async {
    final ApiResponse r = await _api.get(
      '/parts',
      query: <String, dynamic>{
        'search': search,
        'active': active?.toString(),
        'alert': alert?.apiValue,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<Part>(
      items: (r.data as List<dynamic>)
          .map((dynamic p) => Part.fromJson(p as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }

  /// Refacciones activas con existencia que coinciden con [search] (mínimo 2 caracteres).
  Future<List<AvailablePart>> available(String search) async {
    final ApiResponse r = await _api.get('/parts/available', query: <String, dynamic>{'search': search});
    return (r.data as List<dynamic>)
        .map((dynamic p) => AvailablePart.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  /// Conteo de refacciones en stock bajo y agotadas (solo administración).
  Future<AlertsSummary> alerts() async {
    final ApiResponse r = await _api.get('/parts/alerts');
    return AlertsSummary.fromJson(r.data as Map<String, dynamic>);
  }

  Future<Part> get(int id) async {
    final ApiResponse r = await _api.get('/parts/$id');
    return Part.fromJson(r.data as Map<String, dynamic>);
  }

  Future<Part> create(PartInput input) async {
    final ApiResponse r = await _api.post('/parts', body: input.toJson());
    return Part.fromJson(r.data as Map<String, dynamic>);
  }

  /// Edita código, nombre, descripción, precio y stock mínimo (nunca la existencia).
  Future<Part> update(int id, PartInput input) async {
    final ApiResponse r = await _api.patch(
      '/parts/$id',
      body: <String, dynamic>{
        'code': input.code,
        'name': input.name,
        'description': input.description,
        'price': input.price,
        'minimumStock': input.minimumStock,
      },
    );
    return Part.fromJson(r.data as Map<String, dynamic>);
  }

  /// Baja o reactivación lógica de la refacción.
  Future<Part> setActive(int id, {required bool active}) async {
    final ApiResponse r = await _api.post('/parts/$id/${active ? 'activate' : 'deactivate'}');
    return Part.fromJson(r.data as Map<String, dynamic>);
  }

  /// Entrada de mercancía (cantidad entera ≥ 1 y motivo obligatorio).
  Future<MovementResult> registerEntry(int id, {required int quantity, required String reason}) async {
    final ApiResponse r = await _api.post(
      '/parts/$id/entries',
      body: <String, dynamic>{'quantity': quantity, 'reason': reason},
    );
    return MovementResult.fromJson(r.data as Map<String, dynamic>);
  }

  /// Ajuste por conteo físico: [newStock] es la existencia contada.
  Future<MovementResult> registerAdjustment(int id,
      {required int newStock, required String reason}) async {
    final ApiResponse r = await _api.post(
      '/parts/$id/adjustments',
      body: <String, dynamic>{'newStock': newStock, 'reason': reason},
    );
    return MovementResult.fromJson(r.data as Map<String, dynamic>);
  }

  Future<PagedResult<InventoryMovement>> movements(int id, {int page = 1, int pageSize = 20}) async {
    final ApiResponse r = await _api.get(
      '/parts/$id/movements',
      query: <String, dynamic>{'page': page, 'pageSize': pageSize},
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<InventoryMovement>(
      items: (r.data as List<dynamic>)
          .map((dynamic m) => InventoryMovement.fromJson(m as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }
}
