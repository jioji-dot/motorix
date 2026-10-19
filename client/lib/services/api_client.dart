import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Error devuelto por la API con el formato `{ error: { code, message, details } }`.
class ApiException implements Exception {
  ApiException({
    required this.status,
    required this.code,
    required this.message,
    this.details = const [],
    this.extra = const {},
  });

  final int status;
  final String code;
  final String message;
  final List<Map<String, dynamic>> details;
  final Map<String, dynamic> extra;

  @override
  String toString() => message;
}

/// Cliente HTTP de la API de Motorix. El frontend nunca se conecta a la base de datos.
class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000/api');

  final http.Client _client;
  final String baseUrl;

  /// Token de sesión vigente (en memoria).
  String? token;

  /// Se invoca cuando la API responde 401 con una sesión activa (sesión vencida).
  void Function()? onUnauthorized;

  Future<dynamic> get(String path, {Map<String, String?> query = const {}}) =>
      _send('GET', path, query: query);

  Future<dynamic> post(String path, {Object? body}) => _send('POST', path, body: body);

  Future<dynamic> patch(String path, {Object? body}) => _send('PATCH', path, body: body);

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String?> query = const {}}) async {
    final parametros = {
      for (final entrada in query.entries)
        if (entrada.value != null && entrada.value!.isNotEmpty) entrada.key: entrada.value!,
    };
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: parametros.isEmpty ? null : parametros);
    final encabezados = <String, String>{
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };

    late http.Response respuesta;
    try {
      final peticion = http.Request(method, uri)..headers.addAll(encabezados);
      if (body != null) peticion.body = jsonEncode(body);
      final flujo = await _client.send(peticion).timeout(const Duration(seconds: 15));
      respuesta = await http.Response.fromStream(flujo);
    } on TimeoutException {
      throw ApiException(
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
      );
    } catch (_) {
      throw ApiException(
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
      );
    }

    if (respuesta.statusCode == 204 || respuesta.body.isEmpty) return null;

    final dynamic json;
    try {
      json = jsonDecode(utf8.decode(respuesta.bodyBytes));
    } catch (_) {
      throw ApiException(
        status: respuesta.statusCode,
        code: 'INVALID_RESPONSE',
        message: 'El servidor devolvió una respuesta no válida.',
      );
    }

    if (respuesta.statusCode >= 200 && respuesta.statusCode < 300) return json;

    final error = (json is Map ? json['error'] : null) as Map<String, dynamic>?;
    final codigo = (error?['code'] as String?) ?? 'UNKNOWN_ERROR';
    if (respuesta.statusCode == 401 && token != null && codigo == 'UNAUTHENTICATED') {
      onUnauthorized?.call();
    }
    final detalles = (error?['details'] as List?)?.whereType<Map<String, dynamic>>().toList() ?? const [];
    final extra = {
      for (final entrada in (error ?? const <String, dynamic>{}).entries)
        if (!{'code', 'message', 'details'}.contains(entrada.key)) entrada.key: entrada.value,
    };
    throw ApiException(
      status: respuesta.statusCode,
      code: codigo,
      message: (error?['message'] as String?) ?? 'Ocurrió un error inesperado.',
      details: detalles,
      extra: extra,
    );
  }
}
