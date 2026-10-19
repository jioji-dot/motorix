import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'test_app.dart';

Map<String, dynamic> clienteJson(int id, String nombre, {String telefono = '5512345601', bool activo = true}) => {
      'id': id,
      'name': nombre,
      'phone': telefono,
      'email': null,
      'active': activo,
      'createdAt': '2026-10-19T10:00:00.000Z',
      'updatedAt': '2026-10-19T10:00:00.000Z',
    };

Map<String, dynamic> listaJson(List<Map<String, dynamic>> items) => {
      'data': items,
      'meta': {'page': 1, 'pageSize': 20, 'total': items.length},
    };

Map<String, dynamic> vehiculoJson(
  int id,
  int clientId,
  String placas, {
  String marca = 'Nissan',
  String modelo = 'Versa',
  int anio = 2020,
  int km = 45000,
  String propietario = 'Roberto Hernández',
}) =>
    {
      'id': id,
      'clientId': clientId,
      'brand': marca,
      'model': modelo,
      'year': anio,
      'licensePlate': placas,
      'vin': null,
      'currentMileage': km,
      'createdAt': '2026-10-19T10:00:00.000Z',
      'updatedAt': '2026-10-19T10:00:00.000Z',
      'client': {'id': clientId, 'name': propietario, 'phone': '5512345601'},
    };

/// Simula la API: inicio de sesión y las rutas de clientes y vehículos con los datos recibidos.
class ApiSimulada {
  ApiSimulada({required this.rol, List<Map<String, dynamic>>? clientes, List<Map<String, dynamic>>? vehiculos})
      : clientes = clientes ?? [],
        vehiculos = vehiculos ?? [];

  final String rol;
  final List<Map<String, dynamic>> clientes;
  final List<Map<String, dynamic>> vehiculos;
  final List<http.Request> peticiones = [];
  http.Response? Function(http.Request)? sobrescribir;

  List<http.Request> enviadas(String metodo, String ruta) =>
      peticiones.where((p) => p.method == metodo && p.url.path == ruta).toList();

  Future<http.Response> call(http.Request peticion) async {
    peticiones.add(peticion);
    final personalizada = sobrescribir?.call(peticion);
    if (personalizada != null) return personalizada;

    final ruta = peticion.url.path;
    final metodo = peticion.method;
    final busqueda = (peticion.url.queryParameters['search'] ?? '').toLowerCase();

    if (ruta == '/api/auth/login') return loginOk(rol == 'MECHANIC' ? 'mecanico' : 'recepcion', rol);

    if (ruta == '/api/clients' && metodo == 'GET') {
      final filtrados = clientes.where((c) => busqueda.isEmpty || (c['name'] as String).toLowerCase().contains(busqueda));
      return jsonResponse(200, listaJson(filtrados.toList()));
    }
    if (ruta == '/api/clients' && metodo == 'POST') {
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      final nuevo = clienteJson(100 + clientes.length, cuerpo['name'] as String, telefono: cuerpo['phone'] as String);
      clientes.add(nuevo);
      return jsonResponse(201, {'data': nuevo});
    }
    final detalleCliente = RegExp(r'^/api/clients/(\d+)$').firstMatch(ruta);
    if (detalleCliente != null && metodo == 'GET') {
      final id = int.parse(detalleCliente.group(1)!);
      final cliente = clientes.firstWhere((c) => c['id'] == id);
      return jsonResponse(200, {
        'data': {...cliente, 'vehicles': vehiculos.where((v) => v['clientId'] == id).toList()},
      });
    }

    if (ruta == '/api/vehicles' && metodo == 'GET') {
      final filtrados = vehiculos.where((v) =>
          busqueda.isEmpty ||
          (v['licensePlate'] as String).toLowerCase().contains(busqueda) ||
          (v['brand'] as String).toLowerCase().contains(busqueda));
      return jsonResponse(200, listaJson(filtrados.toList()));
    }
    if (ruta == '/api/vehicles' && metodo == 'POST') {
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      final propietario = clientes.firstWhere((c) => c['id'] == cuerpo['clientId']);
      final nuevo = vehiculoJson(
        200 + vehiculos.length,
        cuerpo['clientId'] as int,
        cuerpo['licensePlate'] as String,
        marca: cuerpo['brand'] as String,
        modelo: cuerpo['model'] as String,
        anio: cuerpo['year'] as int,
        km: cuerpo['currentMileage'] as int,
        propietario: propietario['name'] as String,
      );
      vehiculos.add(nuevo);
      return jsonResponse(201, {'data': nuevo});
    }
    final detalleVehiculo = RegExp(r'^/api/vehicles/(\d+)$').firstMatch(ruta);
    if (detalleVehiculo != null && metodo == 'GET') {
      final id = int.parse(detalleVehiculo.group(1)!);
      return jsonResponse(200, {'data': vehiculos.firstWhere((v) => v['id'] == id)});
    }
    if (detalleVehiculo != null && metodo == 'PATCH') {
      final id = int.parse(detalleVehiculo.group(1)!);
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      final actual = vehiculos.firstWhere((v) => v['id'] == id);
      final actualizado = {
        ...actual,
        for (final e in cuerpo.entries)
          if (e.key != 'mileageCorrection') e.key: e.value,
      };
      vehiculos[vehiculos.indexOf(actual)] = actualizado;
      return jsonResponse(200, {'data': actualizado});
    }
    return jsonResponse(404, {'error': {'code': 'NOT_FOUND', 'message': 'No encontrado.'}});
  }
}

Future<void> entrar(WidgetTester tester) async {
  await tester.enterText(find.byKey(const Key('campo-identificador')), 'usuario');
  await tester.enterText(find.byKey(const Key('campo-contrasena')), 'Contrasena2026');
  await tester.tap(find.widgetWithText(FilledButton, 'Iniciar sesión'));
  await tester.pumpAndSettle();
}

