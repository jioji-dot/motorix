import 'dart:convert';

import 'package:http/http.dart' as http;

/// Ayudantes del Sprint 5 para la API simulada (ver specs/005-precios-refacciones-cobro/contracts/api.md).

/// Imita la proyección por rol del servidor: el mecánico no recibe ningún precio ni importe de refacciones
/// ni el total de la orden (FR-008). Los importes de servicios y mano de obra se conservan.
Object? proyectarParaMecanico(Object? json) {
  if (json is List) return json.map(proyectarParaMecanico).toList();
  if (json is Map<String, dynamic>) {
    final esLineaDeRefaccion = json.containsKey('unitPrice');
    final esOrden = json.containsKey('folio');
    final resultado = <String, dynamic>{};
    for (final entrada in json.entries) {
      final clave = entrada.key;
      if (clave == 'salePrice' || clave == 'purchasePrice' || clave == 'unitPrice') continue;
      if (clave == 'amount' && esLineaDeRefaccion) continue;
      if (clave == 'total' && esOrden) continue;
      resultado[clave] = proyectarParaMecanico(entrada.value);
    }
    return resultado;
  }
  return json;
}

/// Aplica [proyectarParaMecanico] al cuerpo de una respuesta JSON; las demás respuestas pasan sin cambios.
http.Response proyectarRespuesta(String? rol, http.Response respuesta) {
  if (rol != 'MECHANIC' || !(respuesta.headers['content-type'] ?? '').contains('json')) return respuesta;
  final cuerpo = jsonDecode(utf8.decode(respuesta.bodyBytes));
  return http.Response.bytes(
    utf8.encode(jsonEncode(proyectarParaMecanico(cuerpo))),
    respuesta.statusCode,
    headers: respuesta.headers,
  );
}

/// Error del servidor cuando el precio de venta es menor al de compra y no se confirmó (FR-004).
http.Response errorVentaMenorAlCosto() => http.Response.bytes(
      utf8.encode(jsonEncode({
        'error': {
          'code': 'PRICE_BELOW_COST',
          'message': 'El precio de venta es menor al de compra. Confirma para guardar de todos modos.',
          'details': [
            {'field': 'salePrice', 'message': 'La venta es menor al costo.'},
          ],
        },
      })),
      409,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
