import 'dart:convert';

import 'package:http/http.dart' as http;

import 'fake_api_s3.dart';
import 'test_app.dart';

/// Pago de ejemplo con la forma de la API (ver specs/004-pagos-tickets-dashboard/contracts/api.md).
Map<String, dynamic> pagoJson(
  int id,
  int orderId, {
  String importe = '500.00',
  String metodo = 'EFECTIVO',
  String estado = 'PAGADO',
  String? referencia,
  String? enlace,
}) =>
    {
      'id': id,
      'orderId': orderId,
      'amount': importe,
      'method': metodo,
      'status': estado,
      'reference': referencia,
      'paymentLink': enlace,
      'paidAt': estado == 'PAGADO' ? '2026-10-19T12:00:00.000Z' : null,
      'createdBy': {'id': 2, 'name': 'Rosa Recepción'},
      'createdAt': '2026-10-19T11:00:00.000Z',
      'updatedAt': '2026-10-19T12:00:00.000Z',
    };

/// Panel de ejemplo con la forma de la API.
Map<String, dynamic> panelJson({
  Map<String, int>? ordenes,
  int ordenesConSaldo = 1,
  String montoPorCobrar = '2080.00',
  int citasHoy = 2,
  int citasProximas = 3,
  List<Map<String, dynamic>>? siguientes,
  int vencidos = 2,
  int proximos = 1,
  int bajas = 2,
  int agotadas = 1,
  List<Map<String, dynamic>>? urgentes,
  String cobradoHoy = '0.00',
  String cobradoMes = '6202.50',
}) =>
    {
      'generatedAt': '2026-10-19T18:30:00.000Z',
      'orders': {
        'byStatus': ordenes ?? {'RECIBIDO': 1, 'EN_REPARACION': 2, 'TERMINADO': 1, 'ENTREGADO': 3},
        'withBalance': {'count': ordenesConSaldo, 'amount': montoPorCobrar},
      },
      'appointments': {
        'today': citasHoy,
        'upcoming': citasProximas,
        'next': siguientes ??
            [
              {
                'id': 4,
                'scheduledAt': '2026-10-20T10:00:00.000',
                'status': 'CONFIRMADA',
                'clientName': 'Roberto Hernández',
                'licensePlate': 'ABC-123-A',
                'reason': 'Revisión general',
              },
            ],
      },
      'maintenance': {'overdue': vencidos, 'soon': proximos},
      'inventory': {
        'low': bajas,
        'out': agotadas,
        'mostUrgent': urgentes ??
            [
              {'id': 5, 'code': 'SEN-O2-01', 'name': 'Sensor de oxígeno', 'stock': 0, 'minimumStock': 2, 'stockLevel': 'OUT'},
              {'id': 6, 'code': 'BUJ-IR-01', 'name': 'Bujía de iridio', 'stock': 2, 'minimumStock': 8, 'stockLevel': 'LOW'},
            ],
      },
      'payments': {'collectedToday': cobradoHoy, 'collectedMonth': cobradoMes, 'pendingToCollect': montoPorCobrar},
    };

/// Simula la API del Sprint 4 (pagos, tickets y panel) además de todo lo anterior.
class ApiCobros extends ApiInventario {
  ApiCobros({
    required super.rol,
    super.clientes,
    super.vehiculos,
    super.usuarios,
    super.citas,
    super.ordenes,
    super.partes,
    super.movimientos,
    super.mantenimientos,
    super.historial,
    Map<int, List<Map<String, dynamic>>>? pagos,
    Map<String, dynamic>? panel,
    this.mercadoPagoConfigurado = true,
  })  : pagos = pagos ?? {},
        panel = panel ?? panelJson();

  final Map<int, List<Map<String, dynamic>>> pagos;
  Map<String, dynamic> panel;

  /// Si es falso, iniciar un pago con Mercado Pago responde 503.
  bool mercadoPagoConfigurado;

  /// Si es verdadero, iniciar o sincronizar con Mercado Pago responde 502.
  bool mercadoPagoCaido = false;

  /// Estado final que Mercado Pago informará la próxima vez que se sincronice un pago (id del pago → estado).
  final Map<int, String> resultadoDeMercadoPago = {};

  final Set<int> ticketsGenerados = {};
  int _siguientePago = 800;

  http.Response _ok(Object data, {int status = 200}) => jsonResponse(status, {'data': data});

  http.Response _error(int status, String codigo, String mensaje, {Map<String, dynamic> extra = const {}}) => jsonResponse(status, {
        'error': {'code': codigo, 'message': mensaje, ...extra},
      });

  List<Map<String, dynamic>> _pagosDe(int orderId) => pagos.putIfAbsent(orderId, () => []);

  Map<String, dynamic> _orden(int id) => ordenes.firstWhere((o) => o['id'] == id);

  double _suma(int orderId, String estado) => _pagosDe(orderId)
      .where((p) => p['status'] == estado)
      .fold<double>(0, (suma, p) => suma + double.parse(p['amount'] as String));

  Map<String, dynamic> _resumen(int orderId) {
    final total = double.parse(_orden(orderId)['total'] as String);
    final pagado = _suma(orderId, 'PAGADO');
    final pendiente = _suma(orderId, 'PENDIENTE');
    final estado = total == 0 ? 'SIN_COBRO' : (pagado == 0 ? 'SIN_PAGOS' : (pagado < total ? 'PARCIAL' : 'PAGADA'));
    String d(double v) => v.toStringAsFixed(2);
    return {
      'total': d(total),
      'paid': d(pagado),
      'pending': d(pendiente),
      'balance': d((total - pagado).clamp(0, double.infinity)),
      'available': d((total - pagado - pendiente).clamp(0, double.infinity)),
      'status': estado,
    };
  }

  Map<String, dynamic> _ticket(int orderId) {
    final orden = _orden(orderId);
    final resumen = _resumen(orderId);
    final metodos = <String>[];
    for (final p in _pagosDe(orderId).where((p) => p['status'] == 'PAGADO')) {
      if (!metodos.contains(p['method'])) metodos.add(p['method'] as String);
    }
    return {
      'id': orderId,
      'folio': 'TK-${orderId.toString().padLeft(6, '0')}',
      'generatedAt': '2026-10-19T18:30:00.000Z',
      'workshop': {'name': 'Motorix Taller Mecánico', 'address': 'Av. Principal 123', 'phone': '5512345678'},
      'order': {'id': orderId, 'folio': orden['folio'], 'status': orden['status'], 'deliveredAt': null},
      'client': {'name': (orden['client'] as Map)['name'], 'phone': '5512345601'},
      'vehicle': {'description': 'Nissan Versa 2020', 'licensePlate': (orden['vehicle'] as Map)['licensePlate'], 'mileage': orden['serviceMileage'] ?? orden['entryMileage']},
      'services': orden['services'],
      'labor': orden['labor'],
      'parts': ((orden['parts'] as List?) ?? const []).map((p) => {'name': (p as Map)['name'], 'quantity': p['quantity'], 'unitPrice': p['unitPrice'], 'amount': p['amount']}).toList(),
      'subtotal': resumen['total'],
      'total': resumen['total'],
      'payment': {'methods': metodos, 'status': resumen['status'], 'paid': resumen['paid'], 'balance': resumen['balance']},
    };
  }

  @override
  Future<http.Response> call(http.Request peticion) async {
    final ruta = peticion.url.path;
    final metodo = peticion.method;
    final enOrden = RegExp(r'^/api/orders/(\d+)/(payments|ticket)(/print-link)?$').firstMatch(ruta);
    final enPago = RegExp(r'^/api/payments/(\d+)/(sync|cancel)$').firstMatch(ruta);
    if (enOrden == null && enPago == null && ruta != '/api/dashboard') return super.call(peticion);

    peticiones.add(peticion);
    final personalizada = sobrescribir?.call(peticion);
    if (personalizada != null) return personalizada;

    if (ruta == '/api/dashboard') return _ok(panel);

    final cuerpo = peticion.body.isEmpty ? <String, dynamic>{} : jsonDecode(peticion.body) as Map<String, dynamic>;

    if (enOrden != null) {
      final orderId = int.parse(enOrden.group(1)!);
      final recurso = enOrden.group(2);
      if (recurso == 'payments' && metodo == 'GET') {
        return _ok({'payments': _pagosDe(orderId).reversed.toList(), 'summary': _resumen(orderId)});
      }
      if (recurso == 'payments' && metodo == 'POST') {
        final importe = (cuerpo['amount'] as num).toDouble();
        final disponible = double.parse(_resumen(orderId)['available'] as String);
        if (importe > disponible + 1e-9) {
          return _error(409, 'PAYMENT_EXCEEDS_BALANCE', 'El importe excede el saldo disponible de la orden ($disponible).', extra: {'balance': disponible.toStringAsFixed(2)});
        }
        final id = _siguientePago++;
        final esMp = cuerpo['method'] == 'MERCADO_PAGO';
        if (esMp && !mercadoPagoConfigurado) {
          return _error(503, 'MP_NOT_CONFIGURED', 'Mercado Pago no está configurado en este servidor. Cobra con otro método.');
        }
        if (esMp && mercadoPagoCaido) {
          return _error(502, 'MP_UNAVAILABLE', 'Mercado Pago no está disponible por ahora. Intenta de nuevo o cobra con otro método.');
        }
        final pago = pagoJson(
          id,
          orderId,
          importe: importe.toStringAsFixed(2),
          metodo: cuerpo['method'] as String,
          estado: esMp ? 'PENDIENTE' : 'PAGADO',
          referencia: cuerpo['reference'] as String?,
          enlace: esMp ? 'https://sandbox.mercadopago.test/pagar/ref-$id' : null,
        );
        _pagosDe(orderId).add(pago);
        return _ok({'payment': pago, 'summary': _resumen(orderId)}, status: 201);
      }
      if (recurso == 'ticket' && enOrden.group(3) != null) {
        return _ok({'url': 'http://prueba/api/tickets/print/token-de-prueba-0123456789', 'expiresInSeconds': 300});
      }
      if (recurso == 'ticket' && metodo == 'POST') {
        final creado = ticketsGenerados.add(orderId);
        return _ok(_ticket(orderId), status: creado ? 201 : 200);
      }
    }

    if (enPago != null) {
      final id = int.parse(enPago.group(1)!);
      for (final entrada in pagos.entries) {
        final pago = entrada.value.where((p) => p['id'] == id).firstOrNull;
        if (pago == null) continue;
        if (pago['status'] != 'PENDIENTE') {
          return _error(409, 'PAYMENT_NOT_PENDING', 'Solo se puede actualizar o cancelar un pago de Mercado Pago que siga Pendiente.');
        }
        if (enPago.group(2) == 'sync') {
          if (mercadoPagoCaido) return _error(502, 'MP_UNAVAILABLE', 'Mercado Pago no está disponible por ahora. Intenta de nuevo o cobra con otro método.');
          final nuevo = resultadoDeMercadoPago[id];
          if (nuevo != null) {
            pago['status'] = nuevo;
            if (nuevo == 'PAGADO') pago['paidAt'] = '2026-10-19T13:00:00.000Z';
          }
        } else {
          pago['status'] = 'CANCELADO';
        }
        return _ok({'payment': pago, 'summary': _resumen(entrada.key)});
      }
      return _error(404, 'NOT_FOUND', 'No se encontró el pago solicitado.');
    }
    return jsonResponse(404, {'error': {'code': 'NOT_FOUND', 'message': 'No encontrado.'}});
  }
}
