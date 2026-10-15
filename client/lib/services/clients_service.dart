import '../models/client.dart';
import '../models/paged_result.dart';
import 'api_client.dart';

/// Llamadas a `/api/clients`.
class ClientsService {
  ClientsService(this._api);

  final ApiClient _api;

  Future<PagedResult<Client>> list({String? search, int page = 1, int pageSize = 20}) async {
    final ApiResponse r = await _api.get(
      '/clients',
      query: <String, dynamic>{'search': search, 'page': page, 'pageSize': pageSize},
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<Client>(
      items: (r.data as List<dynamic>)
          .map((dynamic c) => Client.fromJson(c as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }

  Future<Client> get(int id) async {
    final ApiResponse r = await _api.get('/clients/$id');
    return Client.fromJson(r.data as Map<String, dynamic>);
  }

  Future<Client> create(ClientInput input, {bool confirmDuplicatePhone = false}) async {
    final ApiResponse r = await _api.post(
      '/clients',
      body: <String, dynamic>{
        ...input.toJson(),
        if (confirmDuplicatePhone) 'confirmDuplicatePhone': true,
      },
    );
    return Client.fromJson(r.data as Map<String, dynamic>);
  }

  Future<Client> update(int id, ClientInput input, {bool confirmDuplicatePhone = false}) async {
    final ApiResponse r = await _api.patch(
      '/clients/$id',
      body: <String, dynamic>{
        ...input.toJson(),
        if (confirmDuplicatePhone) 'confirmDuplicatePhone': true,
      },
    );
    return Client.fromJson(r.data as Map<String, dynamic>);
  }
}
