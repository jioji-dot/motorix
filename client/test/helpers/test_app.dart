import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:motorix_client/main.dart';
import 'package:motorix_client/services/api_client.dart';

import 'fake_api_s5.dart';

/// Respuesta simulada de la API para las pruebas.
http.Response jsonResponse(int status, Object body) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Map<String, dynamic> userJson(String username, String role, {int id = 1, String? name}) => {
      'id': id,
      'username': username,
      'name': name ?? 'Usuario $username',
      'email': '$username@motorix.mx',
      'role': role,
      'active': 1,
    };

/// Respuesta de inicio de sesión correcto.
http.Response loginOk(String username, String role) => jsonResponse(200, {
      'data': {
        'token': 'token-de-prueba',
        'expiresIn': 28800,
        'user': userJson(username, role),
      },
    });

/// Crea la aplicación con un cliente HTTP simulado. [handler] recibe cada petición.
Future<ApiClient> bombearApp(
  WidgetTester tester,
  Future<http.Response> Function(http.Request peticion) handler,
) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  // El servidor real no entrega precios ni totales de refacciones al mecánico (Sprint 5, FR-008): el cliente
  // simulado aplica la misma proyección por rol según el usuario que inició sesión.
  String? rolActual;
  Future<http.Response> conProyeccion(http.Request peticion) async {
    final respuesta = await handler(peticion);
    if (peticion.url.path == '/api/auth/login' && respuesta.statusCode == 200) {
      final cuerpo = jsonDecode(utf8.decode(respuesta.bodyBytes)) as Map<String, dynamic>;
      rolActual = ((cuerpo['data'] as Map<String, dynamic>)['user'] as Map<String, dynamic>)['role'] as String?;
      return respuesta;
    }
    return proyectarRespuesta(rolActual, respuesta);
  }

  final api = ApiClient(client: MockClient(conProyeccion), baseUrl: 'http://prueba/api');
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  return api;
}

/// API simulada mínima: inicio de sesión correcto y listados vacíos.
Future<http.Response> Function(http.Request) apiBasica(String role) => (peticion) async {
      if (peticion.url.path == '/api/auth/login') {
        return loginOk(role == 'MECHANIC' ? 'mecanico' : 'recepcion', role);
      }
      if (peticion.method == 'GET') {
        return jsonResponse(200, {
          'data': [],
          'meta': {'page': 1, 'pageSize': 20, 'total': 0},
        });
      }
      return jsonResponse(404, {'error': {'code': 'NOT_FOUND', 'message': 'No encontrado.'}});
    };
