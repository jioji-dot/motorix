import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:motorix_client/services/api_client.dart';

/// Petición registrada por el servidor falso.
class RecordedRequest {
  RecordedRequest(this.method, this.path, this.query, this.body, this.headers);

  final String method;
  final String path;
  final Map<String, String> query;
  final Map<String, dynamic>? body;
  final Map<String, String> headers;
}

typedef FakeHandler = http.Response Function(RecordedRequest request);

/// Respuesta JSON de éxito con el envoltorio `{ data }`.
http.Response jsonData(dynamic data, {int status = 200, Map<String, dynamic>? meta}) {
  final Map<String, dynamic> cuerpo = <String, dynamic>{'data': data};
  if (meta != null) cuerpo['meta'] = meta;
  return http.Response(jsonEncode(cuerpo), status,
      headers: <String, String>{'content-type': 'application/json; charset=utf-8'});
}

/// Respuesta de error con el formato `{ error: { code, message, details } }`.
http.Response jsonError(int status, String code, String message, {dynamic details}) {
  final Map<String, dynamic> error = <String, dynamic>{'code': code, 'message': message};
  if (details != null) error['details'] = details;
  return http.Response(jsonEncode(<String, dynamic>{'error': error}), status,
      headers: <String, String>{'content-type': 'application/json; charset=utf-8'});
}

Map<String, dynamic> userJson({
  int id = 1,
  String username = 'recepcion',
  String name = 'Rosa Recepción',
  String email = 'recepcion@motorix.local',
  String role = 'RECEPTIONIST',
  bool active = true,
}) =>
    <String, dynamic>{
      'id': id,
      'username': username,
      'name': name,
      'email': email,
      'role': role,
      'active': active,
    };

Map<String, dynamic> clientJson({
  int id = 1,
  String name = 'Ana Pérez',
  String phone = '5512345678',
  String? email,
  String? address,
  List<Map<String, dynamic>>? vehicles,
}) =>
    <String, dynamic>{
      'id': id,
      'name': name,
      'phone': phone,
      'email': email,
      'address': address,
      'active': true,
      'createdAt': '2026-10-12T12:00:00.000Z',
      'updatedAt': '2026-10-12T12:00:00.000Z',
      'vehicles': ?vehicles,
    };

Map<String, dynamic> vehicleJson({
  int id = 1,
  int clientId = 1,
  String brand = 'Nissan',
  String model = 'Versa',
  int year = 2020,
  String licensePlate = 'ABC123',
  String? vin,
  String? color,
  int currentMileage = 0,
  String? ownerName,
}) =>
    <String, dynamic>{
      'id': id,
      'clientId': clientId,
      'brand': brand,
      'model': model,
      'year': year,
      'licensePlate': licensePlate,
      'vin': vin,
      'color': color,
      'currentMileage': currentMileage,
      'ownerName': ?ownerName,
      'createdAt': '2026-10-12T12:00:00.000Z',
      'updatedAt': '2026-10-12T12:00:00.000Z',
    };

Map<String, dynamic> appointmentJson({
  int id = 1,
  int clientId = 1,
  int vehicleId = 1,
  String scheduledAt = '2030-01-10T10:00',
  String reason = 'Cambio de aceite',
  String? notes,
  String status = 'PENDIENTE',
  int? orderId,
  String clientName = 'Ana Pérez',
  String vehiclePlate = 'ABC123',
  String vehicleTitle = 'Nissan Versa',
}) =>
    <String, dynamic>{
      'id': id,
      'clientId': clientId,
      'vehicleId': vehicleId,
      'scheduledAt': scheduledAt,
      'reason': reason,
      'notes': notes,
      'status': status,
      'orderId': orderId,
      'clientName': clientName,
      'vehiclePlate': vehiclePlate,
      'vehicleTitle': vehicleTitle,
      'createdAt': '2026-10-12T12:00:00.000Z',
      'updatedAt': '2026-10-12T12:00:00.000Z',
    };

Map<String, dynamic> orderJson({
  int id = 1,
  String folio = 'OS-000001',
  int clientId = 7,
  String clientName = 'Ana Pérez',
  int vehicleId = 3,
  String vehiclePlate = 'ABC123',
  String vehicleTitle = 'Nissan Versa',
  int? mechanicId,
  String? mechanicName,
  int entryMileage = 15000,
  String reportedProblem = 'Ruido al frenar',
  String status = 'RECIBIDO',
  int? appointmentId,
  double total = 0,
  String? diagnosis,
  String? notes,
  String? recommendations,
  List<Map<String, dynamic>> services = const <Map<String, dynamic>>[],
  List<Map<String, dynamic>> labor = const <Map<String, dynamic>>[],
  List<Map<String, dynamic>> parts = const <Map<String, dynamic>>[],
  int? serviceMileage,
  double servicesSubtotal = 0,
  double laborSubtotal = 0,
  double partsSubtotal = 0,
  List<Map<String, dynamic>>? statusHistory,
  List<String> allowedTransitions = const <String>[],
  bool editableWork = false,
  bool editableNotes = false,
  bool editableBasic = false,
  bool editableParts = false,
  Map<String, dynamic>? payment,
  String? paymentStatus,
  int? ticketId,
}) =>
    <String, dynamic>{
      'id': id,
      'folio': folio,
      'clientId': clientId,
      'clientName': clientName,
      'vehicleId': vehicleId,
      'vehiclePlate': vehiclePlate,
      'vehicleTitle': vehicleTitle,
      'mechanicId': mechanicId,
      'mechanicName': mechanicName,
      'entryMileage': entryMileage,
      'reportedProblem': reportedProblem,
      'status': status,
      'appointmentId': appointmentId,
      'total': total,
      'diagnosis': diagnosis,
      'notes': notes,
      'recommendations': recommendations,
      'deliveredAt': null,
      'services': services,
      'labor': labor,
      'parts': parts,
      'serviceMileage': serviceMileage,
      'servicesSubtotal': servicesSubtotal,
      'laborSubtotal': laborSubtotal,
      'partsSubtotal': partsSubtotal,
      'statusHistory': statusHistory ??
          <Map<String, dynamic>>[
            <String, dynamic>{
              'fromStatus': null,
              'toStatus': 'RECIBIDO',
              'changedBy': <String, dynamic>{'id': 1, 'name': 'Rosa Recepción'},
              'createdAt': '2026-10-12T12:00:00.000Z',
            },
          ],
      'allowedTransitions': allowedTransitions,
      'editable': <String, dynamic>{
        'work': editableWork,
        'notesAndRecommendations': editableNotes,
        'basicData': editableBasic,
        'parts': editableParts,
      },
      'payment': payment,
      'paymentStatus': paymentStatus,
      'ticketId': ticketId,
      'createdAt': '2026-10-12T12:00:00.000Z',
      'updatedAt': '2026-10-12T12:00:00.000Z',
    };

/// Resumen de cobro de una orden (importes en pesos, como los entrega el servidor).
Map<String, dynamic> paymentSummaryJson({
  double total = 1000,
  double paid = 0,
  double pending = 0,
  String status = 'UNPAID',
}) =>
    <String, dynamic>{
      'total': total,
      'paid': paid,
      'pending': pending,
      'balance': total - paid,
      'available': total - paid - pending,
      'status': status,
    };

Map<String, dynamic> paymentJson({
  int id = 1,
  int orderId = 5,
  String orderFolio = 'OS-000005',
  String clientName = 'Ana Pérez',
  String vehiclePlate = 'ABC123',
  String method = 'CASH',
  double amount = 500,
  String status = 'APROBADO',
  String? reference,
  String? externalReference,
  String? paymentUrl,
  String? voidReason,
  String? voidedByName,
  String createdByName = 'Rosa Recepción',
  bool canCancel = false,
  bool canVoid = false,
  bool canRefresh = false,
}) =>
    <String, dynamic>{
      'id': id,
      'orderId': orderId,
      'orderFolio': orderFolio,
      'clientName': clientName,
      'vehiclePlate': vehiclePlate,
      'method': method,
      'amount': amount,
      'status': status,
      'reference': reference,
      'externalReference': externalReference,
      'paymentUrl': paymentUrl,
      'voidReason': voidReason,
      'voidedByName': voidedByName,
      'voidedAt': null,
      'createdByName': createdByName,
      'createdAt': '2026-10-13T15:30:00.000Z',
      'canCancel': canCancel,
      'canVoid': canVoid,
      'canRefresh': canRefresh,
    };

/// Ticket de servicio con la forma del contrato (`GET /api/tickets/:id`).
Map<String, dynamic> ticketJson({
  int id = 3,
  String folio = 'TK-000003',
  int orderId = 5,
  String orderFolio = 'OS-000005',
  String orderStatus = 'ENTREGADO',
  List<Map<String, dynamic>>? payments,
  Map<String, dynamic>? summary,
}) =>
    <String, dynamic>{
      'id': id,
      'folio': folio,
      'issuedAt': '2026-10-14T16:25:00.000Z',
      'generatedByName': 'Rosa Recepción',
      'workshop': <String, dynamic>{
        'name': 'Motorix Taller Mecánico',
        'address': 'Av. Principal 123, Ciudad de México',
        'phone': '5555123456',
      },
      'order': <String, dynamic>{
        'id': orderId,
        'folio': orderFolio,
        'status': orderStatus,
        'createdAt': '2026-10-12T12:00:00.000Z',
        'deliveredAt': orderStatus == 'ENTREGADO' ? '2026-10-14T15:00:00.000Z' : null,
      },
      'client': <String, dynamic>{'name': 'Ana Pérez', 'phone': '5511223344'},
      'vehicle': <String, dynamic>{
        'brand': 'Nissan',
        'model': 'Versa',
        'licensePlate': 'PRD482A',
        'entryMileage': 47000,
        'serviceMileage': 47150,
      },
      'services': <Map<String, dynamic>>[
        <String, dynamic>{'description': 'Afinación mayor', 'amount': 450.0},
      ],
      'labor': <Map<String, dynamic>>[
        <String, dynamic>{'description': 'Cambio de bujías', 'hours': 2.5, 'hourlyRate': 350.0, 'amount': 875.0},
      ],
      'parts': <Map<String, dynamic>>[
        <String, dynamic>{'code': 'BUJ-NGK', 'name': 'Bujía de iridio', 'quantity': 4, 'unitPrice': 95.0, 'amount': 380.0},
      ],
      'subtotals': <String, dynamic>{'services': 450.0, 'labor': 875.0, 'parts': 380.0},
      'total': 1705.0,
      'payments': payments ??
          <Map<String, dynamic>>[
            <String, dynamic>{
              'method': 'CARD',
              'amount': 1000.0,
              'status': 'APROBADO',
              'reference': 'AUT-4521',
              'createdAt': '2026-10-14T14:00:00.000Z',
            },
          ],
      'summary': summary ?? paymentSummaryJson(total: 1705, paid: 1000, status: 'PARTIAL'),
    };

/// Respuesta de `GET /api/dashboard`. Cada sección puede reemplazarse para armar escenarios.
Map<String, dynamic> dashboardJson({
  String generatedAt = '2026-10-14T17:00:00.000Z',
  Map<String, dynamic>? orders,
  Map<String, dynamic>? appointments,
  Map<String, dynamic>? maintenance,
  Map<String, dynamic>? inventory,
  Map<String, dynamic>? payments,
}) =>
    <String, dynamic>{
      'generatedAt': generatedAt,
      'orders': orders ??
          <String, dynamic>{
            'received': 2,
            'diagnosis': 1,
            'inRepair': 3,
            'waitingPart': 1,
            'finishedNotDelivered': 4,
            'deliveredToday': 5,
          },
      'appointments': appointments ??
          <String, dynamic>{
            'today': 2,
            'next7Days': 6,
            'next': <String, dynamic>{
              'id': 3,
              'scheduledAt': '2026-10-15T10:00',
              'clientName': 'Ana Pérez',
              'vehiclePlate': 'PRD482A',
              'reason': 'Revisión de frenos',
            },
          },
      'maintenance': maintenance ??
          <String, dynamic>{'overdue': 2, 'upcoming': 3, 'warningDays': 30, 'warningKm': 1000},
      'inventory': inventory ??
          <String, dynamic>{
            'low': 3,
            'out': 1,
            'critical': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 8,
                'code': 'DIS-DEL',
                'name': 'Disco de freno delantero',
                'stock': 0,
                'minimumStock': 2,
                'stockStatus': 'OUT',
              },
              <String, dynamic>{
                'id': 9,
                'code': 'FIL-ACE',
                'name': 'Filtro de aceite',
                'stock': 1,
                'minimumStock': 4,
                'stockStatus': 'LOW',
              },
            ],
          },
      'payments': payments ??
          <String, dynamic>{'collectedToday': 2300.0, 'pendingBalance': 4150.0, 'ordersToCollect': 3},
    };

Map<String, dynamic> orderPartJson({
  int id = 1,
  int partId = 1,
  String code = 'FIL-01',
  String name = 'Filtro de aceite',
  int quantity = 2,
  double unitPrice = 120,
}) =>
    <String, dynamic>{
      'id': id,
      'partId': partId,
      'code': code,
      'name': name,
      'quantity': quantity,
      'unitPrice': unitPrice,
      'amount': quantity * unitPrice,
    };

Map<String, dynamic> partJson({
  int id = 1,
  String code = 'FIL-01',
  String name = 'Filtro de aceite',
  String? description,
  double price = 120,
  int stock = 10,
  int minimumStock = 3,
  bool active = true,
  String? stockStatus,
}) =>
    <String, dynamic>{
      'id': id,
      'code': code,
      'name': name,
      'description': description,
      'price': price,
      'stock': stock,
      'minimumStock': minimumStock,
      'active': active,
      'stockStatus': stockStatus ?? (stock == 0 ? 'OUT' : (stock <= minimumStock ? 'LOW' : 'OK')),
      'createdAt': '2026-10-12T12:00:00.000Z',
      'updatedAt': '2026-10-12T12:00:00.000Z',
    };

Map<String, dynamic> movementJson({
  int id = 1,
  int partId = 1,
  String type = 'IN',
  int quantity = 5,
  String reason = 'Compra a proveedor',
  int? orderId,
  String? orderFolio,
  String createdByName = 'Administrador Motorix',
}) =>
    <String, dynamic>{
      'id': id,
      'partId': partId,
      'type': type,
      'quantity': quantity,
      'reason': reason,
      'orderId': orderId,
      'orderFolio': orderFolio,
      'createdBy': 1,
      'createdByName': createdByName,
      'createdAt': '2026-10-12T12:00:00.000Z',
    };

Map<String, dynamic> maintenanceJson({
  int id = 1,
  int vehicleId = 1,
  String vehiclePlate = 'ABC123',
  String vehicleTitle = 'Nissan Versa',
  int clientId = 1,
  String clientName = 'Ana Pérez',
  String clientPhone = '5512345678',
  int orderId = 5,
  String orderFolio = 'OS-000005',
  String description = 'Cambio de aceite y filtro',
  String? nextDate,
  int? nextMileage = 25000,
  int currentMileage = 20000,
  String status = 'PENDIENTE',
  String? classification = 'LATER',
  int? daysRemaining,
  int? kmRemaining = 5000,
  bool canManage = true,
}) =>
    <String, dynamic>{
      'id': id,
      'vehicleId': vehicleId,
      'vehiclePlate': vehiclePlate,
      'vehicleTitle': vehicleTitle,
      'clientId': clientId,
      'clientName': clientName,
      'clientPhone': clientPhone,
      'orderId': orderId,
      'orderFolio': orderFolio,
      'description': description,
      'nextDate': nextDate,
      'nextMileage': nextMileage,
      'currentMileage': currentMileage,
      'status': status,
      'classification': classification,
      'daysRemaining': daysRemaining,
      'kmRemaining': kmRemaining,
      'completedAt': null,
      'createdAt': '2026-10-12T12:00:00.000Z',
      'canManage': canManage,
    };

/// Respuesta de listado vacío con `meta`.
http.Response emptyList() =>
    jsonData(<dynamic>[], meta: <String, dynamic>{'page': 1, 'pageSize': 20, 'total': 0});

/// Respuesta de listado con elementos.
http.Response listOf(List<Map<String, dynamic>> items, {int? total, int page = 1, int pageSize = 20}) =>
    jsonData(items, meta: <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
      'total': total ?? items.length,
    });

/// Manejador base: acceso con el rol indicado y listados vacíos. [extra] puede responder antes.
FakeHandler baseHandler({String role = 'RECEPTIONIST', http.Response? Function(RecordedRequest)? extra}) {
  return (RecordedRequest r) {
    final http.Response? propia = extra?.call(r);
    if (propia != null) return propia;
    if (r.path == '/auth/login') {
      return jsonData(<String, dynamic>{
        'token': 't',
        'expiresIn': 28800,
        'user': userJson(role: role, name: 'Persona de prueba'),
      });
    }
    if (r.method == 'GET') return emptyList();
    return jsonData(<String, dynamic>{});
  };
}

/// API falsa basada en `MockClient`. Guarda las peticiones recibidas en [requests].
class FakeApi {
  FakeApi(this.handler) {
    client = ApiClient(
      baseUrl: 'http://test/api',
      httpClient: MockClient((http.Request req) async {
        Map<String, dynamic>? body;
        if (req.body.isNotEmpty) body = jsonDecode(req.body) as Map<String, dynamic>;
        final RecordedRequest registro = RecordedRequest(
          req.method,
          req.url.path.replaceFirst('/api', ''),
          req.url.queryParameters,
          body,
          req.headers,
        );
        requests.add(registro);
        return handler(registro);
      }),
    );
  }

  final FakeHandler handler;
  final List<RecordedRequest> requests = <RecordedRequest>[];
  late final ApiClient client;
}
