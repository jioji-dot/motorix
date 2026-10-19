import 'dart:convert';

import 'package:http/http.dart' as http;

import 'fake_api.dart';
import 'test_app.dart';

/// Cita de ejemplo con la forma de la API (ver specs/002-citas-ordenes-servicio/contracts/api.md).
Map<String, dynamic> citaJson(
  int id, {
  int clientId = 1,
  int vehicleId = 1,
  String estado = 'PENDIENTE',
  String fecha = '2030-01-15T10:00:00.000',
  String motivo = 'Revisión general',
  String cliente = 'Roberto Hernández',
  String placas = 'ABC-123-A',
  int? orderId,
}) =>
    {
      'id': id,
      'clientId': clientId,
      'vehicleId': vehicleId,
      'scheduledAt': fecha,
      'reason': motivo,
      'notes': null,
      'status': estado,
      'orderId': orderId,
      'createdAt': '2026-10-19T10:00:00.000Z',
      'updatedAt': '2026-10-19T10:00:00.000Z',
      'client': {'id': clientId, 'name': cliente, 'phone': '5512345601'},
      'vehicle': {'id': vehicleId, 'brand': 'Nissan', 'model': 'Versa', 'year': 2020, 'licensePlate': placas},
    };

/// Orden de ejemplo con el detalle completo.
Map<String, dynamic> ordenJson(
  int id, {
  String estado = 'RECIBIDO',
  int mechanicId = 3,
  String mecanico = 'Mario Mecánico',
  int clientId = 1,
  int vehicleId = 1,
  String cliente = 'Roberto Hernández',
  String placas = 'ABC-123-A',
  String problema = 'Ruido en el motor',
  String? diagnostico,
  List<Map<String, dynamic>>? servicios,
  List<Map<String, dynamic>>? manoDeObra,
  int? appointmentId,
}) =>
    {
      'id': id,
      'folio': 'OS-${id.toString().padLeft(6, '0')}',
      'status': estado,
      'clientId': clientId,
      'vehicleId': vehicleId,
      'mechanicId': mechanicId,
      'appointmentId': appointmentId,
      'entryMileage': 45000,
      'reportedProblem': problema,
      'diagnosis': diagnostico,
      'notes': null,
      'recommendations': null,
      'cancellationReason': null,
      'deliveredAt': null,
      'total': '0.00',
      'createdAt': '2026-10-19T10:00:00.000Z',
      'updatedAt': '2026-10-19T10:00:00.000Z',
      'client': {'id': clientId, 'name': cliente},
      'vehicle': {'id': vehicleId, 'brand': 'Nissan', 'model': 'Versa', 'year': 2020, 'licensePlate': placas},
      'mechanic': {'id': mechanicId, 'name': mecanico},
      'services': servicios ?? <Map<String, dynamic>>[],
      'labor': manoDeObra ?? <Map<String, dynamic>>[],
      'history': [
        {
          'fromStatus': null,
          'toStatus': 'RECIBIDO',
          'changedBy': {'id': 2, 'name': 'Rosa Recepción'},
          'reason': null,
          'changedAt': '2026-10-19T10:00:00.000Z',
        },
      ],
    };

Map<String, dynamic> servicioJson(int id, String descripcion, String importe) =>
    {'id': id, 'description': descripcion, 'amount': importe};

Map<String, dynamic> manoDeObraJson(int id, String descripcion, String horas, String tarifa, String importe) =>
    {'id': id, 'description': descripcion, 'hours': horas, 'hourlyRate': tarifa, 'amount': importe};

/// Transiciones que cada rol puede aplicar (réplica reducida de la máquina de estados del servidor).
List<String> transicionesPermitidas(String rol, String estado) {
  const avance = {
    'RECIBIDO': ['DIAGNOSTICO'],
    'DIAGNOSTICO': ['EN_REPARACION'],
    'EN_REPARACION': ['ESPERANDO_REFACCION', 'TERMINADO'],
    'ESPERANDO_REFACCION': ['EN_REPARACION'],
  };
  const abiertos = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'];
  final permitidas = <String>[];
  if (rol == 'MECHANIC' || rol == 'ADMIN') permitidas.addAll(avance[estado] ?? const []);
  if (rol == 'RECEPTIONIST' || rol == 'ADMIN') {
    if (estado == 'TERMINADO') permitidas.add('ENTREGADO');
    if (abiertos.contains(estado)) permitidas.add('CANCELADA');
  }
  return permitidas;
}

/// Simula la API completa del taller: Sprint 1 más citas, órdenes y mecánicos.
class ApiTaller extends ApiSimulada {
  ApiTaller({
    required super.rol,
    super.clientes,
    super.vehiculos,
    super.usuarios,
    List<Map<String, dynamic>>? citas,
    List<Map<String, dynamic>>? ordenes,
    List<Map<String, dynamic>>? mecanicos,
  })  : citas = citas ?? [],
        ordenes = ordenes ?? [],
        mecanicos = mecanicos ??
            [
              {'id': 3, 'name': 'Mario Mecánico'},
              {'id': 4, 'name': 'Ana Mecánica'},
            ];

  final List<Map<String, dynamic>> citas;
  final List<Map<String, dynamic>> ordenes;
  final List<Map<String, dynamic>> mecanicos;

  http.Response _ok(Object data, {int status = 200, Map<String, dynamic>? meta}) =>
      jsonResponse(status, {'data': data, 'meta': ?meta});

  Map<String, dynamic> _conPermitidas(Map<String, dynamic> orden) =>
      {...orden, 'allowedTransitions': transicionesPermitidas(rol, orden['status'] as String)};

  // Recalcula el total a partir de las líneas.
  void _recalcular(Map<String, dynamic> orden) {
    var total = 0.0;
    for (final s in orden['services'] as List) {
      total += double.parse((s as Map)['amount'] as String);
    }
    for (final l in orden['labor'] as List) {
      total += double.parse((l as Map)['amount'] as String);
    }
    orden['total'] = total.toStringAsFixed(2);
  }

  @override
  Future<http.Response> call(http.Request peticion) async {
    final ruta = peticion.url.path;
    final metodo = peticion.method;
    final esNuestra = ruta.startsWith('/api/appointments') || ruta.startsWith('/api/orders') || ruta == '/api/mechanics';
    if (!esNuestra) return super.call(peticion);

    peticiones.add(peticion);
    final personalizada = sobrescribir?.call(peticion);
    if (personalizada != null) return personalizada;

    final consulta = peticion.url.queryParameters;
    final cuerpo = peticion.body.isEmpty ? <String, dynamic>{} : jsonDecode(peticion.body) as Map<String, dynamic>;

    if (ruta == '/api/mechanics') return _ok(mecanicos);

    // ---- Citas
    if (ruta == '/api/appointments' && metodo == 'GET') {
      final estado = consulta['status'];
      final filtradas = citas.where((c) => estado == null || c['status'] == estado).toList();
      return _ok(filtradas, meta: {'page': 1, 'pageSize': 20, 'total': filtradas.length});
    }
    if (ruta == '/api/appointments' && metodo == 'POST') {
      final cliente = clientes.firstWhere((c) => c['id'] == cuerpo['clientId']);
      final nueva = citaJson(
        50 + citas.length,
        clientId: cuerpo['clientId'] as int,
        vehicleId: cuerpo['vehicleId'] as int,
        fecha: '${cuerpo['scheduledAt']}:00.000',
        motivo: cuerpo['reason'] as String,
        cliente: cliente['name'] as String,
      );
      citas.add(nueva);
      return _ok(nueva, status: 201);
    }
    final cita = RegExp(r'^/api/appointments/(\d+)(?:/(confirm|cancel))?$').firstMatch(ruta);
    if (cita != null) {
      final id = int.parse(cita.group(1)!);
      final actual = citas.firstWhere((c) => c['id'] == id);
      final accion = cita.group(2);
      if (metodo == 'GET') return _ok(actual);
      if (metodo == 'POST' && accion == 'confirm') {
        actual['status'] = 'CONFIRMADA';
        return _ok(actual);
      }
      if (metodo == 'POST' && accion == 'cancel') {
        actual['status'] = 'CANCELADA';
        return _ok(actual);
      }
      if (metodo == 'PATCH') {
        for (final e in cuerpo.entries) {
          if (e.key == 'scheduledAt') {
            actual['scheduledAt'] = '${e.value}:00.000';
          } else if (e.key != 'confirmDuplicate') {
            actual[e.key] = e.value;
          }
        }
        return _ok(actual);
      }
    }

    // ---- Órdenes
    if (ruta == '/api/orders' && metodo == 'GET') {
      final estado = consulta['status'];
      final busqueda = (consulta['search'] ?? '').toLowerCase();
      final filtradas = ordenes.where((o) {
        if (estado != null && o['status'] != estado) return false;
        if (busqueda.isEmpty) return true;
        return (o['folio'] as String).toLowerCase().contains(busqueda) ||
            ((o['client'] as Map)['name'] as String).toLowerCase().contains(busqueda) ||
            ((o['vehicle'] as Map)['licensePlate'] as String).toLowerCase().contains(busqueda);
      }).toList();
      return _ok(filtradas, meta: {'page': 1, 'pageSize': 20, 'total': filtradas.length});
    }
    if (ruta == '/api/orders' && metodo == 'POST') {
      final cliente = clientes.firstWhere((c) => c['id'] == cuerpo['clientId']);
      final mecanico = mecanicos.firstWhere((m) => m['id'] == cuerpo['mechanicId']);
      final nueva = ordenJson(
        100 + ordenes.length,
        mechanicId: cuerpo['mechanicId'] as int,
        mecanico: mecanico['name'] as String,
        clientId: cuerpo['clientId'] as int,
        vehicleId: cuerpo['vehicleId'] as int,
        cliente: cliente['name'] as String,
        problema: (cuerpo['reportedProblem'] as String?) ?? 'Revisión general',
        appointmentId: cuerpo['appointmentId'] as int?,
      );
      nueva['entryMileage'] = cuerpo['entryMileage'];
      ordenes.add(nueva);
      final idCita = cuerpo['appointmentId'];
      if (idCita != null) {
        citas.firstWhere((c) => c['id'] == idCita)['status'] = 'EN_PROCESO';
      }
      return _ok(_conPermitidas(nueva), status: 201);
    }
    final orden = RegExp(r'^/api/orders/(\d+)(?:/(services|labor|status)(?:/(\d+))?)?$').firstMatch(ruta);
    if (orden != null) {
      final id = int.parse(orden.group(1)!);
      final actual = ordenes.firstWhere((o) => o['id'] == id);
      final recurso = orden.group(2);
      final idLinea = orden.group(3) == null ? null : int.parse(orden.group(3)!);

      if (recurso == null && metodo == 'GET') return _ok(_conPermitidas(actual));
      if (recurso == null && metodo == 'PATCH') {
        actual.addAll(cuerpo);
        return _ok(_conPermitidas(actual));
      }
      if (recurso == 'status' && metodo == 'POST') {
        final destino = cuerpo['status'] as String;
        (actual['history'] as List).add({
          'fromStatus': actual['status'],
          'toStatus': destino,
          'changedBy': {'id': 2, 'name': 'Rosa Recepción'},
          'reason': cuerpo['reason'],
          'changedAt': '2026-10-19T11:00:00.000Z',
        });
        actual['status'] = destino;
        if (destino == 'CANCELADA') actual['cancellationReason'] = cuerpo['reason'];
        return _ok(_conPermitidas(actual));
      }
      if (recurso == 'services' || recurso == 'labor') {
        final lista = actual[recurso == 'services' ? 'services' : 'labor'] as List;
        if (metodo == 'POST') {
          final nuevoId = 500 + lista.length;
          if (recurso == 'services') {
            lista.add(servicioJson(nuevoId, cuerpo['description'] as String, (cuerpo['amount'] as num).toStringAsFixed(2)));
          } else {
            final importe = (cuerpo['hours'] as num) * (cuerpo['hourlyRate'] as num);
            lista.add(manoDeObraJson(
              nuevoId,
              cuerpo['description'] as String,
              (cuerpo['hours'] as num).toStringAsFixed(2),
              (cuerpo['hourlyRate'] as num).toStringAsFixed(2),
              importe.toStringAsFixed(2),
            ));
          }
        } else if (metodo == 'DELETE') {
          lista.removeWhere((l) => (l as Map)['id'] == idLinea);
        } else if (metodo == 'PATCH') {
          final linea = lista.firstWhere((l) => (l as Map)['id'] == idLinea) as Map<String, dynamic>;
          for (final e in cuerpo.entries) {
            linea[e.key] = e.value is num ? (e.value as num).toStringAsFixed(2) : e.value;
          }
          if (recurso == 'labor') {
            linea['amount'] = (double.parse(linea['hours'] as String) * double.parse(linea['hourlyRate'] as String)).toStringAsFixed(2);
          }
        }
        _recalcular(actual);
        return _ok(_conPermitidas(actual), status: metodo == 'POST' ? 201 : 200);
      }
    }
    return jsonResponse(404, {'error': {'code': 'NOT_FOUND', 'message': 'No encontrado.'}});
  }
}

