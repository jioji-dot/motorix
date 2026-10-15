import '../models/dashboard.dart';
import 'api_client.dart';

/// Consulta del panel de control (`GET /api/dashboard`, solo administración).
class DashboardService {
  DashboardService(this._api);

  final ApiClient _api;

  Future<Dashboard> fetch() async {
    final ApiResponse r = await _api.get('/dashboard');
    return Dashboard.fromJson(r.data as Map<String, dynamic>);
  }
}
