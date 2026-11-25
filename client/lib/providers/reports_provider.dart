import 'package:flutter/foundation.dart';

import '../models/report.dart';
import '../services/api_client.dart';
import '../services/external_links.dart';
import '../utils/error_text.dart';

String _iso(DateTime f) => '${f.year.toString().padLeft(4, '0')}-${f.month.toString().padLeft(2, '0')}-${f.day.toString().padLeft(2, '0')}';

/// Reportes del administrador: se calculan en el servidor al consultarlos; la aplicación no guarda copias (Sprint 7).
class ReportsProvider extends ChangeNotifier {
  ReportsProvider(this.api, {DateTime Function()? ahora}) : _ahora = ahora ?? DateTime.now {
    final hoy = _ahora();
    from = _iso(DateTime(hoy.year, hoy.month, 1));
    to = _iso(hoy);
  }

  final ApiClient api;
  final DateTime Function() _ahora;

  ReportKind kind = ReportKind.income;
  late String from;
  late String to;
  String groupBy = 'day';

  Map<String, dynamic>? data;
  bool loading = false;
  String? error;

  void reset() {
    kind = ReportKind.income;
    final hoy = _ahora();
    from = _iso(DateTime(hoy.year, hoy.month, 1));
    to = _iso(hoy);
    groupBy = 'day';
    data = null;
    loading = false;
    error = null;
    notifyListeners();
  }

  Map<String, String> get _consulta => {'from': from, 'to': to, if (kind == ReportKind.income) 'groupBy': groupBy};

  void selectKind(ReportKind nuevo) {
    kind = nuevo;
    load();
  }

  void setGroupBy(String valor) {
    groupBy = valor;
    load();
  }

  void setRange(String desde, String hasta) {
    from = desde;
    to = hasta;
    load();
  }

  /// Atajos de la pantalla: este mes, el mes pasado y los últimos 12 meses.
  void setShortcut(String atajo) {
    final hoy = _ahora();
    switch (atajo) {
      case 'mes':
        setRange(_iso(DateTime(hoy.year, hoy.month, 1)), _iso(hoy));
      case 'mes-pasado':
        setRange(_iso(DateTime(hoy.year, hoy.month - 1, 1)), _iso(DateTime(hoy.year, hoy.month, 0)));
      case 'anio':
        setRange(_iso(DateTime(hoy.year, hoy.month, hoy.day).subtract(const Duration(days: 364))), _iso(hoy));
    }
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final respuesta = await api.get('/reports/${kind.path}', query: _consulta) as Map<String, dynamic>;
      data = respuesta['data'] as Map<String, dynamic>;
    } on ApiException catch (e) {
      error = errorText(e);
      data = null;
    } catch (_) {
      error = 'No se pudo leer la respuesta del servidor. Intenta de nuevo.';
      data = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Pide el enlace de descarga del reporte en pantalla y lo abre. Devuelve el mensaje de error o nulo si salió bien.
  Future<String?> export() async {
    try {
      final respuesta = await api.get('/reports/${kind.path}/export-link', query: _consulta) as Map<String, dynamic>;
      final url = (respuesta['data'] as Map<String, dynamic>)['url'] as String;
      final direccion = Uri.parse(api.baseUrl).resolve(url);
      final abierto = await openExternalUrl(direccion);
      return abierto ? null : 'No se pudo abrir la descarga. Intenta de nuevo.';
    } catch (e) {
      return errorText(e);
    }
  }
}
