import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/client.dart';
import '../models/paged_result.dart';
import '../services/clients_service.dart';

/// Estado de los clientes: listado con búsqueda y paginación, detalle, alta y edición.
class ClientsProvider extends ChangeNotifier {
  ClientsProvider(this._service);

  final ClientsService _service;

  PagedResult<Client>? _result;
  String _search = '';
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  Client? _detail;
  bool _detailLoading = false;
  String? _detailError;

  PagedResult<Client>? get result => _result;
  String get search => _search;
  bool get loading => _loading;
  String? get error => _error;

  Client? get detail => _detail;
  bool get detailLoading => _detailLoading;
  String? get detailError => _detailError;

  /// Carga una página del listado. Ignora respuestas de búsquedas anteriores ya reemplazadas.
  Future<void> load({int page = 1, String? search}) async {
    if (search != null) _search = search.trim();
    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final PagedResult<Client> pagina =
          await _service.list(search: _search, page: page);
      if (solicitud != _requestId) return;
      _result = pagina;
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

  Future<void> loadDetail(int id) async {
    _detailLoading = true;
    _detailError = null;
    _detail = null;
    notifyListeners();
    try {
      _detail = await _service.get(id);
    } on ApiError catch (error) {
      _detailError = error.message;
    } catch (_) {
      _detailError = 'El servidor respondió con un formato inesperado.';
    } finally {
      _detailLoading = false;
      notifyListeners();
    }
  }

  /// Registra un cliente. Lanza [ApiError] (por ejemplo `PHONE_DUPLICATE_WARNING`).
  Future<Client> create(ClientInput input, {bool confirmDuplicatePhone = false}) =>
      _service.create(input, confirmDuplicatePhone: confirmDuplicatePhone);

  /// Edita un cliente. Lanza [ApiError] si el servidor rechaza los datos.
  Future<Client> update(int id, ClientInput input, {bool confirmDuplicatePhone = false}) =>
      _service.update(id, input, confirmDuplicatePhone: confirmDuplicatePhone);
}
