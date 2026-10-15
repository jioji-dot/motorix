import '../models/history_entry.dart';
import '../models/paged_result.dart';
import '../models/vehicle.dart';
import 'api_client.dart';

/// Llamadas a `/api/vehicles`.
class VehiclesService {
  VehiclesService(this._api);

  final ApiClient _api;

  Future<PagedResult<Vehicle>> list({
    String? search,
    int? clientId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final ApiResponse r = await _api.get(
      '/vehicles',
      query: <String, dynamic>{
        'search': search,
        'clientId': clientId,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<Vehicle>(
      items: (r.data as List<dynamic>)
          .map((dynamic v) => Vehicle.fromJson(v as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }

  /// Historial de servicios del vehículo (órdenes terminadas o entregadas), del más reciente al más antiguo.
  Future<PagedResult<HistoryEntry>> fetchHistory(int id, {int page = 1, int pageSize = 20}) async {
    final ApiResponse r = await _api.get(
      '/vehicles/$id/history',
      query: <String, dynamic>{'page': page, 'pageSize': pageSize},
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<HistoryEntry>(
      items: (r.data as List<dynamic>)
          .map((dynamic e) => HistoryEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }

  Future<Vehicle> get(int id) async {
    final ApiResponse r = await _api.get('/vehicles/$id');
    return Vehicle.fromJson(r.data as Map<String, dynamic>);
  }

  Future<Vehicle> create(VehicleInput input) async {
    final ApiResponse r = await _api.post('/vehicles', body: input.toJson());
    return Vehicle.fromJson(r.data as Map<String, dynamic>);
  }

  Future<Vehicle> update(int id, VehicleInput input, {bool mileageCorrection = false}) async {
    final ApiResponse r = await _api.patch(
      '/vehicles/$id',
      body: <String, dynamic>{
        ...input.toJson(),
        if (mileageCorrection) 'mileageCorrection': true,
      },
    );
    return Vehicle.fromJson(r.data as Map<String, dynamic>);
  }
}
