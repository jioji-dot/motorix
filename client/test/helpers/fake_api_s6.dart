import 'dart:convert';

import 'package:http/http.dart' as http;

import 'fake_api_s4.dart';
import 'test_app.dart';

/// Ayudantes del Sprint 6 para la API simulada (ver specs/006-notificaciones-internas/contracts/api.md).

Map<String, dynamic> avisoJson(
  String key,
  String tipo,
  String titulo, {
  String detalle = 'Detalle del aviso',
  bool leido = false,
  String destino = 'order',
  int id = 1,
  String? busqueda,
}) =>
    {
      'key': key,
      'type': tipo,
      'read': leido,
      'title': titulo,
      'detail': detalle,
      'data': <String, dynamic>{},
      'target': {'kind': destino, 'id': id, 'search': ?busqueda},
    };

/// Grupo de avisos; `total` permite simular más avisos de los que muestra el panel.
Map<String, dynamic> grupoJson(String tipo, List<Map<String, dynamic>> avisos, {int? total}) => {
      'type': tipo,
      'total': total ?? avisos.length,
      'unread': avisos.where((a) => a['read'] != true).length,
      'items': avisos,
    };

/// Hecho pendiente de avisar a un cliente.
Map<String, dynamic> hechoJson({
  String kind = 'ORDEN_LISTA',
  int factId = 5,
  String motivo = 'Vehículo listo',
  String cliente = 'María López',
  String telefono = '5512345678',
  String placas = 'ABC-123-A',
  String vehiculo = 'Nissan Versa',
  String detalle = 'Orden OS-000005 terminada',
  String destino = 'order',
}) =>
    {
      'kind': kind,
      'factId': factId,
      'reason': motivo,
      'factDate': '2026-11-20T18:30:00.000Z',
      'client': {'id': 2, 'name': cliente, 'phone': telefono},
      'vehicle': {'id': 3, 'licensePlate': placas, 'title': vehiculo},
      'detail': detalle,
      'target': {'kind': destino, 'id': factId},
    };

/// Avisos de ejemplo de todos los tipos, como los vería el administrador.
List<Map<String, dynamic>> gruposDeEjemplo() => [
      grupoJson('MAINTENANCE_OVERDUE', [
        avisoJson('MANT:12:VENCIDO', 'MAINTENANCE_OVERDUE', 'Cambio de aceite vencido',
            detalle: 'Chevrolet Aveo JKL-012-D · Juan Pérez', destino: 'maintenance', id: 12, busqueda: 'JKL-012-D'),
      ]),
      grupoJson('APPOINTMENT_TODAY', [
        avisoJson('CITA:8', 'APPOINTMENT_TODAY', 'Cita de hoy a las 16:00', destino: 'appointment', id: 8),
      ]),
      grupoJson('STOCK_OUT', [
        avisoJson('STOCK:5:AGOTADO', 'STOCK_OUT', 'Sensor de oxígeno agotada', destino: 'part', id: 5),
      ]),
      grupoJson('ORDER_STALLED', [
        avisoJson('ORDEN:7', 'ORDER_STALLED', 'Orden OS-000007 detenida', destino: 'order', id: 7),
      ]),
    ];

/// Simula la API del Sprint 6 (avisos y clientes por avisar) además de todo lo anterior.
/// Imita el filtro por rol del servidor: recepción no recibe stock y el mecánico solo órdenes detenidas.
class ApiAvisos extends ApiCobros {
  ApiAvisos({
    required super.rol,
    super.clientes,
    super.vehiculos,
    super.citas,
    super.ordenes,
    super.partes,
    super.mantenimientos,
    List<Map<String, dynamic>>? grupos,
    List<Map<String, dynamic>>? hechos,
  })  : grupos = grupos ?? gruposDeEjemplo(),
        hechos = hechos ?? [hechoJson()];

  /// Todos los grupos que vería el administrador.
  List<Map<String, dynamic>> grupos;
  final List<Map<String, dynamic>> hechos;
  final Set<String> leidas = {};

  /// Si es verdadero, marcar como avisado responde 409 (el hecho ya no aplica).
  bool hechoYaNoAplica = false;

  http.Response _ok(Object data, {int status = 200, Object? meta}) =>
      jsonResponse(status, {'data': data, 'meta': ?meta});

  Set<String> get _tiposPermitidos => switch (rol) {
        'ADMIN' => {'MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'APPOINTMENT_TODAY', 'STOCK_OUT', 'STOCK_LOW', 'ORDER_STALLED'},
        'RECEPTIONIST' => {'MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'APPOINTMENT_TODAY', 'ORDER_STALLED'},
        _ => {'ORDER_STALLED'},
      };

  Map<String, dynamic> _avisos() {
    final visibles = [
      for (final g in grupos)
        if (_tiposPermitidos.contains(g['type']))
          grupoJson(
            g['type'] as String,
            [
              for (final a in (g['items'] as List<dynamic>).cast<Map<String, dynamic>>())
                {...a, 'read': leidas.contains(a['key'])},
            ],
            total: g['total'] as int,
          ),
    ];
    final stock = visibles.where((g) => (g['type'] as String).startsWith('STOCK')).fold<int>(0, (s, g) => s + (g['total'] as int));
    return {
      'unread': visibles.fold<int>(0, (s, g) => s + (g['unread'] as int)),
      'total': visibles.fold<int>(0, (s, g) => s + (g['total'] as int)),
      'groups': visibles,
      if (rol == 'ADMIN') 'stockAlerts': stock,
      if (rol != 'MECHANIC') 'clientsToNotify': hechos.length,
    };
  }

  @override
  Future<http.Response> call(http.Request peticion) async {
    final ruta = peticion.url.path;
    final metodo = peticion.method;
    if (ruta != '/api/notifications' && ruta != '/api/notifications/read' && ruta != '/api/client-notices') {
      return super.call(peticion);
    }

    peticiones.add(peticion);
    final personalizada = sobrescribir?.call(peticion);
    if (personalizada != null) return personalizada;

    if (ruta == '/api/notifications' && metodo == 'GET') return _ok(_avisos(), meta: {'limitPerType': 10});

    if (ruta == '/api/notifications/read' && metodo == 'POST') {
      final clave = (jsonDecode(peticion.body) as Map<String, dynamic>)['key'] as String;
      final existe = _avisos()['groups'].any((g) => (g['items'] as List<dynamic>).any((a) => a['key'] == clave));
      if (existe) leidas.add(clave);
      return _ok({'key': clave, 'read': existe});
    }

    if (rol == 'MECHANIC') {
      return jsonResponse(403, {'error': {'code': 'FORBIDDEN', 'message': 'No tienes permiso para realizar esta acción.'}});
    }
    if (ruta == '/api/client-notices' && metodo == 'GET') {
      return _ok(hechos, meta: {'page': 1, 'pageSize': 50, 'total': hechos.length});
    }
    if (ruta == '/api/client-notices' && metodo == 'POST') {
      if (hechoYaNoAplica) {
        return jsonResponse(409, {
          'error': {'code': 'NOTICE_NOT_APPLICABLE', 'message': 'Este aviso ya no aplica: la situación del cliente cambió. Actualiza la lista.'},
        });
      }
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      hechos.removeWhere((h) => h['kind'] == cuerpo['kind'] && h['factId'] == cuerpo['factId']);
      return _ok({'id': 1, 'kind': cuerpo['kind'], 'factId': cuerpo['factId']}, status: 201);
    }
    return jsonResponse(404, {'error': {'code': 'NOT_FOUND', 'message': 'No encontrado.'}});
  }
}
