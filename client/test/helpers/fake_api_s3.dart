import 'dart:convert';

import 'package:http/http.dart' as http;

import 'fake_api_s2.dart';
import 'test_app.dart';

/// Refacción de ejemplo con la forma de la API (ver specs/003-historial-mantenimiento-inventario/contracts/api.md).
/// `purchasePrice` solo lo agrega la API simulada cuando el rol es ADMIN.
Map<String, dynamic> parteJson(
  int id,
  String nombre, {
  String? codigo,
  int stock = 10,
  int minimo = 3,
  String categoria = 'Aceites y filtros',
  String marca = 'Bosch',
  bool activa = true,
  String precioVenta = '150.00',
  String precioCompra = '90.00',
}) =>
    {
      'id': id,
      'code': codigo ?? 'REF-${id.toString().padLeft(3, '0')}',
      'name': nombre,
      'category': categoria,
      'brand': marca,
      'stock': stock,
      'minimumStock': minimo,
      'salePrice': precioVenta,
      '_purchasePrice': precioCompra,
      'active': activa,
      'createdAt': '2026-10-19T10:00:00.000Z',
      'updatedAt': '2026-10-19T10:00:00.000Z',
    };

Map<String, dynamic> movimientoJson(
  int id,
  String tipo,
  int cantidad,
  int stockResultante, {
  String motivo = 'Existencia inicial',
  int? ordenId,
  String? folio,
}) =>
    {
      'id': id,
      'type': tipo,
      'quantity': cantidad,
      'stockAfter': stockResultante,
      'reason': motivo,
      'orderId': ordenId,
      'orderFolio': folio,
      'createdBy': {'id': 1, 'name': 'Ana Administradora'},
      'createdAt': '2026-10-19T10:00:00.000Z',
    };

/// Mantenimiento de ejemplo con la forma de la API. `clasificacion` nula significa Atendido.
Map<String, dynamic> mantenimientoJson(
  int id, {
  int vehicleId = 1,
  String tipo = 'Cambio de aceite',
  String estado = 'PENDIENTE',
  String? clasificacion = 'NORMAL',
  String? proximaFecha = '2027-03-01',
  int? proximoKm = 55000,
  int? dias = 130,
  int? km = 5000,
  String cliente = 'Roberto Hernández',
  String placas = 'ABC-123-A',
}) =>
    {
      'id': id,
      'vehicleId': vehicleId,
      'serviceType': tipo,
      'lastServiceDate': '2026-10-01',
      'lastMileage': 50000,
      'nextDate': proximaFecha,
      'nextMileage': proximoKm,
      'notes': null,
      'status': estado,
      'completedAt': null,
      'sourceOrderId': null,
      'classification': clasificacion,
      'daysLeft': dias,
      'kmLeft': km,
      'createdAt': '2026-10-19T10:00:00.000Z',
      'updatedAt': '2026-10-19T10:00:00.000Z',
      'vehicle': {'id': vehicleId, 'brand': 'Nissan', 'model': 'Versa', 'year': 2020, 'licensePlate': placas, 'currentMileage': 50000},
      'client': {'id': 1, 'name': cliente, 'phone': '5512345601'},
    };

/// Entrada del historial de servicios de un vehículo.
Map<String, dynamic> historialJson(
  int orderId, {
  String estado = 'ENTREGADO',
  String fecha = '2026-10-05T16:30:00.000Z',
  int km = 48200,
  String? diagnostico = 'Banda de accesorios desgastada.',
  String? recomendaciones = 'Revisar el alternador en el próximo servicio.',
  List<Map<String, dynamic>>? servicios,
  List<Map<String, dynamic>>? manoDeObra,
  List<Map<String, dynamic>>? refacciones,
  String total = '2482.50',
}) =>
    {
      'orderId': orderId,
      'folio': 'OS-${orderId.toString().padLeft(6, '0')}',
      'status': estado,
      'serviceDate': fecha,
      'mileage': km,
      'mechanic': {'id': 3, 'name': 'Mario Mecánico'},
      'diagnosis': diagnostico,
      'notes': null,
      'recommendations': recomendaciones,
      'total': total,
      'services': servicios ?? <Map<String, dynamic>>[],
      'labor': manoDeObra ?? <Map<String, dynamic>>[],
      'parts': refacciones ?? <Map<String, dynamic>>[],
    };

Map<String, dynamic> refaccionDeOrdenJson(int id, int partId, String nombre, int cantidad, String precio) => {
      'id': id,
      'partId': partId,
      'code': 'REF-${partId.toString().padLeft(3, '0')}',
      'name': nombre,
      'quantity': cantidad,
      'unitPrice': precio,
      'amount': (cantidad * double.parse(precio)).toStringAsFixed(2),
    };

String _nivel(Map<String, dynamic> parte) {
  final stock = parte['stock'] as int;
  if (stock == 0) return 'OUT';
  return stock <= (parte['minimumStock'] as int) ? 'LOW' : 'OK';
}

/// Simula la API del Sprint 3: inventario, mantenimientos, historial y refacciones en las órdenes,
/// además de todo lo anterior (clientes, vehículos, citas y órdenes).
class ApiInventario extends ApiTaller {
  ApiInventario({
    required super.rol,
    super.clientes,
    super.vehiculos,
    super.usuarios,
    super.citas,
    super.ordenes,
    List<Map<String, dynamic>>? partes,
    Map<int, List<Map<String, dynamic>>>? movimientos,
    List<Map<String, dynamic>>? mantenimientos,
    Map<int, List<Map<String, dynamic>>>? historial,
  })  : partes = partes ?? [],
        movimientos = movimientos ?? {},
        mantenimientos = mantenimientos ?? [],
        historial = historial ?? {};

  final List<Map<String, dynamic>> partes;
  final Map<int, List<Map<String, dynamic>>> movimientos;
  final List<Map<String, dynamic>> mantenimientos;
  final Map<int, List<Map<String, dynamic>>> historial;

  bool get _esAdmin => rol == 'ADMIN';

  http.Response _ok(Object data, {int status = 200, Map<String, dynamic>? meta}) =>
      jsonResponse(status, {'data': data, 'meta': ?meta});

  http.Response _error(int status, String codigo, String mensaje, {Map<String, dynamic> extra = const {}}) =>
      jsonResponse(status, {
        'error': {'code': codigo, 'message': mensaje, ...extra},
      });

  // La parte "pública" de una refacción: oculta el precio de compra a quien no es administrador.
  Map<String, dynamic> _publica(Map<String, dynamic> parte) {
    final copia = {...parte}..remove('_purchasePrice');
    copia['stockLevel'] = (parte['active'] as bool) ? _nivel(parte) : null;
    if (_esAdmin) copia['purchasePrice'] = parte['_purchasePrice'];
    return copia;
  }

  Map<String, dynamic> _parte(int id) => partes.firstWhere((p) => p['id'] == id);

  void _anotar(int partId, String tipo, int cambio, String motivo, {int? ordenId, String? folio}) {
    final parte = _parte(partId);
    parte['stock'] = (parte['stock'] as int) + cambio;
    final lista = movimientos.putIfAbsent(partId, () => []);
    lista.insert(0, movimientoJson(900 + lista.length, tipo, cambio, parte['stock'] as int, motivo: motivo, ordenId: ordenId, folio: folio));
  }

  Map<String, dynamic> _ordenCompleta(Map<String, dynamic> orden) {
    var total = 0.0;
    for (final s in orden['services'] as List) {
      total += double.parse((s as Map)['amount'] as String);
    }
    for (final l in orden['labor'] as List) {
      total += double.parse((l as Map)['amount'] as String);
    }
    for (final r in (orden['parts'] as List? ?? const [])) {
      total += double.parse((r as Map)['amount'] as String);
    }
    orden['total'] = total.toStringAsFixed(2);
    return {...orden, 'allowedTransitions': transicionesPermitidas(rol, orden['status'] as String)};
  }

  @override
  Future<http.Response> call(http.Request peticion) async {
    final ruta = peticion.url.path;
    final metodo = peticion.method;
    final esNuestra = ruta.startsWith('/api/parts') ||
        ruta.startsWith('/api/maintenance') ||
        RegExp(r'^/api/vehicles/\d+/history$').hasMatch(ruta) ||
        RegExp(r'^/api/orders/\d+/parts').hasMatch(ruta);
    if (!esNuestra) return super.call(peticion);

    peticiones.add(peticion);
    final personalizada = sobrescribir?.call(peticion);
    if (personalizada != null) return personalizada;

    final consulta = peticion.url.queryParameters;
    final cuerpo = peticion.body.isEmpty ? <String, dynamic>{} : jsonDecode(peticion.body) as Map<String, dynamic>;

    // ---- Historial
    final historia = RegExp(r'^/api/vehicles/(\d+)/history$').firstMatch(ruta);
    if (historia != null) {
      final entradas = historial[int.parse(historia.group(1)!)] ?? [];
      return _ok(entradas, meta: {'page': 1, 'pageSize': 100, 'total': entradas.length});
    }

    // ---- Refacciones de una orden
    final enOrden = RegExp(r'^/api/orders/(\d+)/parts(?:/(\d+))?$').firstMatch(ruta);
    if (enOrden != null) {
      final orden = ordenes.firstWhere((o) => o['id'] == int.parse(enOrden.group(1)!));
      final lineas = (orden['parts'] ??= <Map<String, dynamic>>[]) as List;
      final folio = orden['folio'] as String;
      if (metodo == 'POST') {
        final parte = _parte(cuerpo['partId'] as int);
        final cantidad = cuerpo['quantity'] as int;
        if (cantidad > (parte['stock'] as int)) {
          return _error(409, 'INSUFFICIENT_STOCK', 'No hay existencias suficientes de "${parte['name']}". Stock disponible: ${parte['stock']}.',
              extra: {'available': parte['stock']});
        }
        _anotar(parte['id'] as int, 'OUT', -cantidad, 'Uso en la orden $folio', ordenId: orden['id'] as int, folio: folio);
        lineas.add(refaccionDeOrdenJson(700 + lineas.length, parte['id'] as int, parte['name'] as String, cantidad, parte['salePrice'] as String));
        return _ok(_ordenCompleta(orden), status: 201);
      }
      final idLinea = int.parse(enOrden.group(2)!);
      final linea = lineas.firstWhere((l) => (l as Map)['id'] == idLinea) as Map<String, dynamic>;
      if (metodo == 'DELETE') {
        _anotar(linea['partId'] as int, 'IN', linea['quantity'] as int, 'Reversa por quitar la refacción de la orden $folio',
            ordenId: orden['id'] as int, folio: folio);
        lineas.remove(linea);
        return _ok(_ordenCompleta(orden));
      }
      if (metodo == 'PATCH') {
        final nueva = cuerpo['quantity'] as int;
        final diferencia = nueva - (linea['quantity'] as int);
        final parte = _parte(linea['partId'] as int);
        if (diferencia > (parte['stock'] as int)) {
          return _error(409, 'INSUFFICIENT_STOCK', 'No hay existencias suficientes. Stock disponible: ${parte['stock']}.',
              extra: {'available': parte['stock']});
        }
        _anotar(linea['partId'] as int, diferencia > 0 ? 'OUT' : 'IN', -diferencia, 'Cambio de cantidad en la orden $folio',
            ordenId: orden['id'] as int, folio: folio);
        linea['quantity'] = nueva;
        linea['amount'] = (nueva * double.parse(linea['unitPrice'] as String)).toStringAsFixed(2);
        return _ok(_ordenCompleta(orden));
      }
    }

    // ---- Refacciones
    if (ruta == '/api/parts/summary') {
      final activas = partes.where((p) => p['active'] == true).toList();
      final fuera = activas.where((p) => _nivel(p) == 'OUT').length;
      final bajas = activas.where((p) => _nivel(p) == 'LOW').length;
      return _ok({'total': activas.length, 'ok': activas.length - fuera - bajas, 'low': bajas, 'out': fuera});
    }
    if (ruta == '/api/parts/categories') {
      return _ok({for (final p in partes.where((p) => p['active'] == true)) p['category'] as String}.toList()..sort());
    }
    if (ruta == '/api/parts' && metodo == 'GET') {
      final busqueda = (consulta['search'] ?? '').toLowerCase();
      final niveles = (consulta['stockLevel'] ?? '').split(',').where((n) => n.isNotEmpty).toList();
      final filtradas = partes.where((p) {
        if (!_esAdmin && p['active'] != true) return false;
        if (consulta['active'] == 'true' && p['active'] != true) return false;
        if (consulta['category'] != null && p['category'] != consulta['category']) return false;
        if (niveles.isNotEmpty && (p['active'] != true || !niveles.contains(_nivel(p)))) return false;
        if (busqueda.isEmpty) return true;
        return '${p['code']} ${p['name']} ${p['category']} ${p['brand']}'.toLowerCase().contains(busqueda);
      }).map(_publica).toList();
      return _ok(filtradas, meta: {'page': 1, 'pageSize': 20, 'total': filtradas.length});
    }
    if (ruta == '/api/parts' && metodo == 'POST') {
      if (partes.any((p) => (p['code'] as String).toLowerCase() == (cuerpo['code'] as String).toLowerCase())) {
        return _error(409, 'DUPLICATE_VALUE', 'Ya existe una refacción con ese código.', extra: {
          'details': [
            {'field': 'code', 'message': 'Ya existe una refacción con ese código.'},
          ],
        });
      }
      final nueva = parteJson(
        100 + partes.length,
        cuerpo['name'] as String,
        codigo: cuerpo['code'] as String,
        stock: 0,
        minimo: cuerpo['minimumStock'] as int,
        categoria: cuerpo['category'] as String,
        marca: cuerpo['brand'] as String,
        precioVenta: (cuerpo['salePrice'] as num).toStringAsFixed(2),
        precioCompra: (cuerpo['purchasePrice'] as num).toStringAsFixed(2),
      );
      partes.add(nueva);
      final inicial = cuerpo['initialStock'] as int?;
      if (inicial != null && inicial > 0) _anotar(nueva['id'] as int, 'IN', inicial, 'Existencia inicial');
      return _ok(_publica(nueva), status: 201);
    }
    final detalle = RegExp(r'^/api/parts/(\d+)(?:/(movements))?$').firstMatch(ruta);
    if (detalle != null) {
      final id = int.parse(detalle.group(1)!);
      final parte = _parte(id);
      if (detalle.group(2) == null && metodo == 'GET') {
        return _ok({..._publica(parte), 'movements': movimientos[id] ?? []});
      }
      if (detalle.group(2) == null && metodo == 'PATCH') {
        for (final e in cuerpo.entries) {
          if (e.key == 'purchasePrice') {
            parte['_purchasePrice'] = (e.value as num).toStringAsFixed(2);
          } else if (e.key == 'salePrice') {
            parte['salePrice'] = (e.value as num).toStringAsFixed(2);
          } else {
            parte[e.key] = e.value;
          }
        }
        return _ok(_publica(parte));
      }
      if (detalle.group(2) == 'movements' && metodo == 'POST') {
        final tipo = cuerpo['type'] as String;
        final cantidad = cuerpo['quantity'] as int;
        final cambio = tipo == 'OUT' ? -cantidad : cantidad;
        if ((parte['stock'] as int) + cambio < 0) {
          return _error(409, 'INSUFFICIENT_STOCK', 'No hay existencias suficientes. Stock disponible: ${parte['stock']}.',
              extra: {'available': parte['stock']});
        }
        _anotar(id, tipo, cambio, cuerpo['reason'] as String);
        return _ok({'movement': (movimientos[id] ?? []).first, 'part': _publica(parte)}, status: 201);
      }
    }

    // ---- Mantenimientos
    if (ruta == '/api/maintenance' && metodo == 'GET') {
      final clases = (consulta['classification'] ?? '').split(',').where((c) => c.isNotEmpty).toList();
      final busqueda = (consulta['search'] ?? '').toLowerCase();
      final filtrados = mantenimientos.where((m) {
        if (m['status'] != 'PENDIENTE') return false;
        if (clases.isNotEmpty && !clases.contains(m['classification'])) return false;
        if (busqueda.isEmpty) return true;
        return '${(m['client'] as Map)['name']} ${(m['vehicle'] as Map)['licensePlate']} ${m['serviceType']}'.toLowerCase().contains(busqueda);
      }).toList();
      return _ok(filtrados, meta: {'page': 1, 'pageSize': 20, 'total': filtrados.length});
    }
    if (ruta == '/api/maintenance' && metodo == 'POST') {
      final nuevo = mantenimientoJson(
        200 + mantenimientos.length,
        vehicleId: cuerpo['vehicleId'] as int,
        tipo: cuerpo['serviceType'] as String,
        proximaFecha: cuerpo['nextDate'] as String?,
        proximoKm: cuerpo['nextMileage'] as int?,
      );
      mantenimientos.add(nuevo);
      return _ok(nuevo, status: 201);
    }
    final uno = RegExp(r'^/api/maintenance/(\d+)$').firstMatch(ruta);
    if (uno != null) {
      final actual = mantenimientos.firstWhere((m) => m['id'] == int.parse(uno.group(1)!));
      if (metodo == 'GET') return _ok(actual);
      if (metodo == 'PATCH') {
        actual.addAll(cuerpo.map((k, v) => MapEntry(k == 'nextDate' ? 'nextDate' : k, v)));
        return _ok(actual);
      }
    }
    return jsonResponse(404, {'error': {'code': 'NOT_FOUND', 'message': 'No encontrado.'}});
  }
}
