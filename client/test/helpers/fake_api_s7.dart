import 'dart:convert';

import 'package:http/http.dart' as http;

import 'fake_api_s6.dart';
import 'test_app.dart';

/// Ayudantes del Sprint 7 para la API simulada (ver specs/007-reportes-configuracion/contracts/api.md).

Map<String, dynamic> terminosJson({int version = 1, bool aceptados = false}) => {
      'version': version,
      'termsText': 'TÉRMINOS Y CONDICIONES\n\n1. Uso permitido del sistema.\n2. Confidencialidad de los datos de clientes.',
      'privacyText': 'AVISO DE PRIVACIDAD\n\nLos datos se usan solo para el servicio.',
      'publishedAt': '2026-11-25T10:00:00.000Z',
      'accepted': aceptados,
    };

Map<String, dynamic> tipoJson(int id, String nombre, {int? dias = 180, int? km = 5000, bool activo = true}) =>
    {'id': id, 'name': nombre, 'intervalDays': dias, 'intervalKm': km, 'active': activo};

Map<String, dynamic> entradaDeBitacora(int id, String accion, {String usuario = 'Administrador', String entidad = 'user', Map<String, dynamic>? detalle}) => {
      'id': id,
      'action': accion,
      'entity': entidad,
      'entityId': 3,
      'user': {'id': 1, 'name': usuario},
      'actorLabel': null,
      'detail': detalle,
      'createdAt': '2026-11-25T15:30:00.000Z',
    };

/// Reportes de ejemplo con la forma de la API.
Map<String, dynamic> reportesDeEjemplo() => {
      'income': {
        'total': '400.00',
        'byMethod': [
          {'method': 'EFECTIVO', 'total': '149.45'},
          {'method': 'TARJETA', 'total': '250.55'},
        ],
        'byPeriod': [
          {'period': '2026-11-23', 'total': '100.10'},
          {'period': '2026-11-24', 'total': '299.90'},
        ],
      },
      'services': {
        'items': [
          {'name': 'Cambio de aceite', 'typed': true, 'count': 3, 'amount': '260.30'},
          {'name': 'Alineación', 'typed': false, 'count': 2, 'amount': '410.00'},
        ],
      },
      'productivity': {
        'items': [
          {'mechanic': {'id': 3, 'name': 'Mario Mecánico'}, 'orders': 2, 'laborAmount': '1225.00'},
        ],
        'totalOrders': 2,
        'totalLabor': '1225.00',
      },
      'parts': {
        'items': [
          {'part': {'id': 1, 'code': 'REF-001', 'name': 'Filtro de aceite'}, 'units': 3, 'cost': '240.75', 'sale': '371.00', 'margin': '130.25', 'noCost': false},
          {'part': {'id': 2, 'code': 'REF-002', 'name': 'Pieza sin costo'}, 'units': 1, 'cost': null, 'sale': '50.00', 'margin': null, 'noCost': true},
        ],
        'totalSale': '421.00',
        'totalCost': '240.75',
        'totalMargin': '130.25',
      },
      'rotation': {
        'items': [
          {'part': {'id': 1, 'code': 'REF-001', 'name': 'Filtro de aceite'}, 'unitsOut': 3, 'stock': 10, 'rotation': 0.3},
          {'part': {'id': 3, 'code': 'REF-003', 'name': 'Pieza agotada'}, 'unitsOut': 3, 'stock': 0, 'rotation': null},
        ],
      },
    };

/// Simula la API del Sprint 7 (configuración, tipos de servicio, términos, bitácora y reportes) además de todo lo anterior.
class ApiAdmin extends ApiAvisos {
  ApiAdmin({
    required super.rol,
    super.ordenes,
    super.mantenimientos,
    this.terminos,
    this.aceptado = false,
    List<Map<String, dynamic>>? tipos,
    List<Map<String, dynamic>>? bitacora,
  })  : tipos = tipos ?? [tipoJson(1, 'Cambio de aceite'), tipoJson(2, 'Frenos', dias: 365, km: 20000, activo: false)],
        bitacora = bitacora ?? [entradaDeBitacora(2, 'USER_ROLE_CHANGED', detalle: {'from': 'MECHANIC', 'to': 'RECEPTIONIST'}), entradaDeBitacora(1, 'SETTINGS_CHANGED', entidad: 'settings')];

  /// Versión vigente de los términos (nulo si no hay ninguna publicada) y si el usuario actual la aceptó.
  Map<String, dynamic>? terminos;
  bool aceptado;

  Map<String, dynamic> ajustes = {
    'workshop': {'name': 'Taller Motorix', 'address': 'Av. Principal 123', 'phone': '5512345678'},
    'maintenance': {'warnDays': 15, 'warnKm': 500},
    'defaults': {'warnDays': 15, 'warnKm': 500},
  };
  List<Map<String, dynamic>> tipos;
  List<Map<String, dynamic>> bitacora;
  Map<String, dynamic> reportes = reportesDeEjemplo();

  /// Si es verdadero, toda petición responde 401 `SESSION_INACTIVE`.
  bool sesionInactiva = false;

  http.Response _ok(Object? data, {int status = 200, Object? meta}) => jsonResponse(status, {'data': data, 'meta': ?meta});

  http.Response _error(int status, String codigo, String mensaje) => jsonResponse(status, {'error': {'code': codigo, 'message': mensaje}});

  bool get _esAdmin => rol == 'ADMIN';

  @override
  Future<http.Response> call(http.Request peticion) async {
    final ruta = peticion.url.path;
    final metodo = peticion.method;
    final esLogin = ruta == '/api/auth/login';

    if (!esLogin && sesionInactiva) {
      peticiones.add(peticion);
      return _error(401, 'SESSION_INACTIVE', 'Tu sesión se cerró por inactividad. Inicia sesión de nuevo.');
    }
    final exenta = esLogin || ruta == '/api/auth/me' || ruta == '/api/terms/current' || ruta == '/api/terms/accept';
    if (!exenta && terminos != null && !aceptado) {
      peticiones.add(peticion);
      return _error(403, 'TERMS_NOT_ACCEPTED', 'Debes aceptar los términos y condiciones y el aviso de privacidad para continuar.');
    }

    final propia = ruta.startsWith('/api/terms') ||
        ruta == '/api/settings' ||
        ruta.startsWith('/api/service-types') ||
        ruta == '/api/audit-log' ||
        ruta.startsWith('/api/reports');
    if (!propia) return super.call(peticion);

    peticiones.add(peticion);
    final personalizada = sobrescribir?.call(peticion);
    if (personalizada != null) return personalizada;

    final soloAdmin = ruta == '/api/settings' ||
        ruta == '/api/audit-log' ||
        ruta.startsWith('/api/reports') ||
        ruta == '/api/terms/acceptances' ||
        (ruta == '/api/terms' && metodo == 'POST') ||
        (ruta.startsWith('/api/service-types') && metodo != 'GET');
    if (soloAdmin && !_esAdmin) return _error(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.');

    if (ruta == '/api/terms/current') return _ok(terminos == null ? null : {...terminos!, 'accepted': aceptado});
    if (ruta == '/api/terms/accept') {
      aceptado = true;
      return _ok({'version': terminos?['version'] ?? 1, 'acceptedAt': '2026-11-25T12:00:00.000Z'});
    }
    if (ruta == '/api/terms' && metodo == 'POST') {
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      terminos = {...terminosJson(version: ((terminos?['version'] as int?) ?? 0) + 1), 'termsText': cuerpo['termsText'], 'privacyText': cuerpo['privacyText']};
      aceptado = true;
      return _ok({...terminos!, 'accepted': true}, status: 201);
    }
    if (ruta == '/api/terms/acceptances') {
      return _ok({
        'version': terminos?['version'],
        'accepted': [{'userId': 1, 'name': 'Administrador', 'acceptedAt': '2026-11-25T11:00:00.000Z'}],
        'pending': [{'userId': 2, 'name': 'Recepción'}],
      });
    }

    if (ruta == '/api/settings' && metodo == 'GET') return _ok(ajustes);
    if (ruta == '/api/settings' && metodo == 'PUT') {
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      final taller = (cuerpo['workshop'] as Map<String, dynamic>?) ?? {};
      final mantenimiento = (cuerpo['maintenance'] as Map<String, dynamic>?) ?? {};
      final dias = mantenimiento['warnDays'];
      if (dias is int && (dias < 1 || dias > 365)) {
        return jsonResponse(400, {
          'error': {
            'code': 'VALIDATION_ERROR',
            'message': 'Revisa los datos enviados.',
            'details': [{'field': 'maintenance.warnDays', 'message': 'Los días de margen debe ser un número entero de 1 a 365 días.'}],
          },
        });
      }
      ajustes = {
        ...ajustes,
        'workshop': {...(ajustes['workshop'] as Map<String, dynamic>), ...taller},
        'maintenance': {...(ajustes['maintenance'] as Map<String, dynamic>), ...mantenimiento},
      };
      return _ok(ajustes);
    }

    if (ruta == '/api/service-types' && metodo == 'GET') return _ok(_esAdmin ? tipos : tipos.where((t) => t['active'] == true).toList());
    if (ruta == '/api/service-types' && metodo == 'POST') {
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      if (tipos.any((t) => (t['name'] as String).toLowerCase() == (cuerpo['name'] as String).toLowerCase())) {
        return _error(409, 'SERVICE_TYPE_DUPLICATE', 'Ya existe un tipo de servicio con ese nombre.');
      }
      final nuevo = tipoJson(10 + tipos.length, cuerpo['name'] as String, dias: cuerpo['intervalDays'] as int?, km: cuerpo['intervalKm'] as int?);
      tipos.add(nuevo);
      return _ok(nuevo, status: 201);
    }
    final editar = RegExp(r'^/api/service-types/(\d+)$').firstMatch(ruta);
    if (editar != null && metodo == 'PATCH') {
      final id = int.parse(editar.group(1)!);
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      final i = tipos.indexWhere((t) => t['id'] == id);
      tipos[i] = {...tipos[i], ...cuerpo};
      return _ok(tipos[i]);
    }

    if (ruta == '/api/audit-log') {
      final accion = peticion.url.queryParameters['action'];
      final filtradas = bitacora.where((e) => accion == null || e['action'] == accion).toList();
      return _ok(filtradas, meta: {'page': 1, 'pageSize': 50, 'total': filtradas.length});
    }

    final enlace = RegExp(r'^/api/reports/(\w+)/export-link$').firstMatch(ruta);
    if (enlace != null) return _ok({'url': '/api/reports/export/token-de-prueba', 'expiresInSeconds': 60});
    final reporte = RegExp(r'^/api/reports/(\w+)$').firstMatch(ruta);
    if (reporte != null && reportes.containsKey(reporte.group(1))) {
      final desde = peticion.url.queryParameters['from'];
      final hasta = peticion.url.queryParameters['to'];
      if (desde != null && hasta != null && desde.compareTo(hasta) > 0) {
        return jsonResponse(400, {
          'error': {'code': 'VALIDATION_ERROR', 'message': 'Revisa los datos enviados.', 'details': [{'field': 'to', 'message': 'La fecha final no puede ser anterior a la inicial.'}]},
        });
      }
      return _ok(reportes[reporte.group(1)]);
    }
    return _error(404, 'NOT_FOUND', 'No encontrado.');
  }
}
