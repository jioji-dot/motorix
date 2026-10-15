import '../models/maintenance.dart';
import '../models/paged_result.dart';
import 'api_client.dart';

/// Llamadas a `/api/maintenance` y a los mantenimientos de un vehículo.
class MaintenanceService {
  MaintenanceService(this._api);

  final ApiClient _api;

  Maintenance _one(ApiResponse r) => Maintenance.fromJson(r.data as Map<String, dynamic>);

  /// Registra el próximo mantenimiento desde una orden terminada o entregada. Con un pendiente
  /// en el vehículo responde `MAINTENANCE_PENDING_EXISTS` salvo que [replacePending] sea verdadero.
  Future<Maintenance> create(int orderId, MaintenanceInput input, {bool replacePending = false}) async =>
      _one(await _api.post(
        '/maintenance',
        body: <String, dynamic>{
          'orderId': orderId,
          'description': input.description,
          'nextDate': input.nextDate,
          'nextMileage': input.nextMileage,
          if (replacePending) 'replacePending': true,
        },
      ));

  /// Edita un mantenimiento pendiente. Solo se envían los datos que cambian; un valor nulo
  /// explícito quita la fecha o el kilometraje.
  Future<Maintenance> update(
    int id, {
    String? description,
    String? nextDate,
    bool clearDate = false,
    int? nextMileage,
    bool clearMileage = false,
  }) async =>
      _one(await _api.patch(
        '/maintenance/$id',
        body: <String, dynamic>{
          'description': ?description,
          if (clearDate) 'nextDate': null else 'nextDate': ?nextDate,
          if (clearMileage) 'nextMileage': null else 'nextMileage': ?nextMileage,
        },
      ));

  Future<Maintenance> complete(int id) async => _one(await _api.post('/maintenance/$id/complete'));

  Future<Maintenance> cancel(int id) async => _one(await _api.post('/maintenance/$id/cancel'));

  /// Página del listado de avisos junto con los umbrales de aviso vigentes.
  Future<MaintenanceListResult> list({
    MaintenanceFilter filter = MaintenanceFilter.alert,
    String? search,
    int page = 1,
    int pageSize = 20,
  }) async {
    final ApiResponse r = await _api.get(
      '/maintenance',
      query: <String, dynamic>{
        'classification': filter.classification,
        'status': filter.status,
        'search': search,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return MaintenanceListResult(
      result: PagedResult<Maintenance>(
        items: (r.data as List<dynamic>)
            .map((dynamic m) => Maintenance.fromJson(m as Map<String, dynamic>))
            .toList(),
        total: (meta['total'] as int?) ?? 0,
        page: (meta['page'] as int?) ?? page,
        pageSize: (meta['pageSize'] as int?) ?? pageSize,
      ),
      warningDays: (meta['warningDays'] as int?) ?? 30,
      warningKm: (meta['warningKm'] as int?) ?? 1000,
    );
  }

  /// Mantenimientos del vehículo: el pendiente primero y luego los cerrados.
  Future<List<Maintenance>> forVehicle(int vehicleId) async {
    final ApiResponse r = await _api.get('/vehicles/$vehicleId/maintenance');
    return (r.data as List<dynamic>)
        .map((dynamic m) => Maintenance.fromJson(m as Map<String, dynamic>))
        .toList();
  }
}

/// Resultado del listado de avisos: la página y los umbrales con los que se clasificó.
class MaintenanceListResult {
  const MaintenanceListResult({
    required this.result,
    required this.warningDays,
    required this.warningKm,
  });

  final PagedResult<Maintenance> result;
  final int warningDays;
  final int warningKm;
}
