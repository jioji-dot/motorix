import 'package:flutter/foundation.dart';

import '../models/appointment.dart';
import '../services/api_client.dart';

/// Periodos rápidos para filtrar la agenda.
enum AppointmentPeriod {
  all('Todas las fechas'),
  today('Hoy'),
  next7('Próximos 7 días'),
  month('Este mes');

  const AppointmentPeriod(this.label);

  final String label;
}

/// Estado de la agenda de citas y operaciones sobre ellas.
class AppointmentsProvider extends ChangeNotifier {
  AppointmentsProvider(this.api, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  final ApiClient api;
  final DateTime Function() _now;

  List<Appointment> items = [];
  int total = 0;
  int page = 1;
  final int pageSize = 20;
  String search = '';
  String? statusFilter;
  AppointmentPeriod period = AppointmentPeriod.all;
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  /// Vacía el estado al terminar la sesión.
  void reset() {
    items = [];
    total = 0;
    page = 1;
    search = '';
    statusFilter = null;
    period = AppointmentPeriod.all;
    loading = false;
    error = null;
    notifyListeners();
  }

  static String _fecha(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// Rango `from`/`to` (AAAA-MM-DD) del periodo elegido.
  (String?, String?) get range {
    final hoy = _now();
    switch (period) {
      case AppointmentPeriod.all:
        return (null, null);
      case AppointmentPeriod.today:
        return (_fecha(hoy), _fecha(hoy));
      case AppointmentPeriod.next7:
        return (_fecha(hoy), _fecha(hoy.add(const Duration(days: 6))));
      case AppointmentPeriod.month:
        return (_fecha(DateTime(hoy.year, hoy.month, 1)), _fecha(DateTime(hoy.year, hoy.month + 1, 0)));
    }
  }

  Future<void> load({int? page}) async {
    if (page != null) this.page = page;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final (from, to) = range;
      final respuesta = await api.get('/appointments', query: {
        'search': search.trim(),
        'status': statusFilter,
        'from': from,
        'to': to,
        'page': this.page.toString(),
        'pageSize': pageSize.toString(),
      }) as Map<String, dynamic>;
      items = (respuesta['data'] as List).map((c) => Appointment.fromJson(c as Map<String, dynamic>)).toList();
      total = (respuesta['meta'] as Map<String, dynamic>)['total'] as int;
    } on ApiException catch (e) {
      error = e.message;
      items = [];
    } catch (_) {
      error = 'No se pudo leer la respuesta del servidor. Intenta de nuevo.';
      items = [];
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void setSearch(String valor) {
    search = valor;
    load(page: 1);
  }

  void setStatusFilter(String? valor) {
    statusFilter = valor;
    load(page: 1);
  }

  void setPeriod(AppointmentPeriod valor) {
    period = valor;
    load(page: 1);
  }

  Future<Appointment> fetchDetail(int id) async {
    final respuesta = await api.get('/appointments/$id') as Map<String, dynamic>;
    return Appointment.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Appointment> create(Map<String, dynamic> datos) async {
    final respuesta = await api.post('/appointments', body: datos) as Map<String, dynamic>;
    return Appointment.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Appointment> update(int id, Map<String, dynamic> datos) async {
    final respuesta = await api.patch('/appointments/$id', body: datos) as Map<String, dynamic>;
    return Appointment.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Appointment> confirm(int id) async {
    final respuesta = await api.post('/appointments/$id/confirm') as Map<String, dynamic>;
    return Appointment.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Appointment> cancel(int id) async {
    final respuesta = await api.post('/appointments/$id/cancel') as Map<String, dynamic>;
    return Appointment.fromJson(respuesta['data'] as Map<String, dynamic>);
  }
}
