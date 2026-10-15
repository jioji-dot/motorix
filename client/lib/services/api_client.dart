import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/api_error.dart';

/// Respuesta exitosa de la API: `data` y, en listados, `meta`.
class ApiResponse {
  ApiResponse({this.data, this.meta, this.statusCode = 200});

  final dynamic data;

  /// Código HTTP de la respuesta (por ejemplo 201 al crear y 200 al reutilizar).
  final int statusCode;
  final Map<String, dynamic>? meta;
}

/// Cliente HTTP de la API de Motorix. El token se guarda solo en memoria.
class ApiClient {
  ApiClient({http.Client? httpClient, String? baseUrl})
      : _http = httpClient ?? http.Client(),
        baseUrl = baseUrl ??
            const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000/api');

  final http.Client _http;
  final String baseUrl;

  String? _token;

  /// Se invoca cuando el servidor responde 401 con una sesión iniciada (sesión expirada).
  void Function()? onUnauthorized;

  void setToken(String? token) => _token = token;

  bool get hasToken => _token != null;

  Uri _uri(String ruta, [Map<String, dynamic>? query]) {
    final Map<String, String>? parametros = query == null
        ? null
        : <String, String>{
            for (final MapEntry<String, dynamic> e in query.entries)
              if (e.value != null && e.value.toString().isNotEmpty) e.key: e.value.toString(),
          };
    return Uri.parse('$baseUrl$ruta').replace(queryParameters: parametros);
  }

  Map<String, String> _headers() => <String, String>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<ApiResponse> get(String ruta, {Map<String, dynamic>? query}) =>
      _send(() => _http.get(_uri(ruta, query), headers: _headers()));

  Future<ApiResponse> post(String ruta, {Object? body}) => _send(
      () => _http.post(_uri(ruta), headers: _headers(), body: jsonEncode(body ?? <String, dynamic>{})));

  Future<ApiResponse> patch(String ruta, {Object? body}) => _send(
      () => _http.patch(_uri(ruta), headers: _headers(), body: jsonEncode(body ?? <String, dynamic>{})));

  Future<ApiResponse> delete(String ruta) =>
      _send(() => _http.delete(_uri(ruta), headers: _headers()));

  Future<ApiResponse> _send(Future<http.Response> Function() peticion) async {
    final http.Response respuesta;
    try {
      respuesta = await peticion().timeout(const Duration(seconds: 15));
    } on TimeoutException {
      throw ApiError.network();
    } on http.ClientException {
      throw ApiError.network();
    } catch (_) {
      throw ApiError.network();
    }

    Map<String, dynamic>? cuerpo;
    if (respuesta.body.isNotEmpty) {
      try {
        final dynamic decodificado = jsonDecode(utf8.decode(respuesta.bodyBytes));
        if (decodificado is Map<String, dynamic>) cuerpo = decodificado;
      } catch (_) {
        cuerpo = null;
      }
    }

    if (respuesta.statusCode >= 200 && respuesta.statusCode < 300) {
      return ApiResponse(
        data: cuerpo?['data'],
        meta: cuerpo?['meta'] as Map<String, dynamic>?,
        statusCode: respuesta.statusCode,
      );
    }

    final ApiError error = ApiError.fromResponse(respuesta.statusCode, cuerpo);
    if (error.code == 'UNAUTHENTICATED' && _token != null) {
      onUnauthorized?.call();
    }
    throw error;
  }
}
