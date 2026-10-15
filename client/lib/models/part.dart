import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Estado de existencia de una refacción, calculado por la API (`OK`, `LOW`, `OUT`).
enum StockStatus {
  ok('OK', 'Normal', AppColors.success),
  low('LOW', 'Stock bajo', AppColors.warning),
  out('OUT', 'Agotada', AppColors.danger);

  const StockStatus(this.apiValue, this.label, this.color);

  final String apiValue;
  final String label;
  final Color color;

  /// Hay que reabastecer: stock bajo o agotada.
  bool get isAlert => this != ok;

  static StockStatus fromApi(String valor) =>
      StockStatus.values.firstWhere((StockStatus s) => s.apiValue == valor, orElse: () => ok);
}

/// Refacción tal como la devuelve la API.
class Part {
  const Part({
    required this.id,
    required this.code,
    required this.name,
    required this.price,
    required this.stock,
    required this.minimumStock,
    required this.active,
    required this.stockStatus,
    this.description,
  });

  final int id;
  final String code;
  final String name;
  final String? description;
  final double price;
  final int stock;
  final int minimumStock;
  final bool active;
  final StockStatus stockStatus;

  factory Part.fromJson(Map<String, dynamic> json) => Part(
        id: json['id'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        price: (json['price'] as num).toDouble(),
        stock: json['stock'] as int,
        minimumStock: json['minimumStock'] as int,
        active: json['active'] as bool,
        stockStatus: StockStatus.fromApi(json['stockStatus'] as String),
      );
}

/// Datos capturados en el formulario de refacción.
class PartInput {
  const PartInput({
    required this.code,
    required this.name,
    required this.price,
    required this.minimumStock,
    this.description,
    this.initialStock,
  });

  final String code;
  final String name;
  final String? description;
  final double price;
  final int minimumStock;

  /// Solo se envía al registrar; la existencia no se edita directamente.
  final int? initialStock;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'code': code,
        'name': name,
        'description': description,
        'price': price,
        'minimumStock': minimumStock,
        'initialStock': ?initialStock,
      };
}

/// Filtro de alerta del inventario. `null` en el listado equivale a "todas".
enum AlertFilter {
  any('ANY', 'Con alerta'),
  low('LOW', 'Stock bajo'),
  out('OUT', 'Agotadas');

  const AlertFilter(this.apiValue, this.label);

  final String apiValue;
  final String label;
}

/// Conteo de refacciones activas en alerta, para la insignia del menú.
class AlertsSummary {
  const AlertsSummary({required this.low, required this.out});

  final int low;
  final int out;

  int get total => low + out;

  factory AlertsSummary.fromJson(Map<String, dynamic> json) =>
      AlertsSummary(low: json['low'] as int, out: json['out'] as int);
}

/// Refacción ofrecida al mecánico para agregar a una orden (activa y con existencia).
class AvailablePart {
  const AvailablePart({
    required this.id,
    required this.code,
    required this.name,
    required this.price,
    required this.stock,
  });

  final int id;
  final String code;
  final String name;
  final double price;
  final int stock;

  factory AvailablePart.fromJson(Map<String, dynamic> json) => AvailablePart(
        id: json['id'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        price: (json['price'] as num).toDouble(),
        stock: json['stock'] as int,
      );
}

/// Tipo de movimiento de inventario: `IN` (entrada), `OUT` (salida por orden) o `ADJUSTMENT`.
enum MovementType {
  entry('IN', 'Entrada'),
  exit('OUT', 'Salida'),
  adjustment('ADJUSTMENT', 'Ajuste');

  const MovementType(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static MovementType fromApi(String valor) =>
      MovementType.values.firstWhere((MovementType t) => t.apiValue == valor, orElse: () => adjustment);
}

/// Movimiento de inventario. `quantity` lleva signo (la salida es negativa).
class InventoryMovement {
  const InventoryMovement({
    required this.id,
    required this.partId,
    required this.type,
    required this.quantity,
    required this.reason,
    required this.createdAt,
    this.orderId,
    this.orderFolio,
    this.createdByName,
  });

  final int id;
  final int partId;
  final MovementType type;
  final int quantity;
  final String reason;
  final int? orderId;
  final String? orderFolio;
  final String? createdByName;
  final DateTime? createdAt;

  factory InventoryMovement.fromJson(Map<String, dynamic> json) => InventoryMovement(
        id: json['id'] as int,
        partId: json['partId'] as int,
        type: MovementType.fromApi(json['type'] as String),
        quantity: json['quantity'] as int,
        reason: json['reason'] as String,
        orderId: json['orderId'] as int?,
        orderFolio: json['orderFolio'] as String?,
        createdByName: json['createdByName'] as String?,
        createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? ''),
      );
}

/// Resultado de una entrada o un ajuste: la refacción actualizada y el movimiento generado.
class MovementResult {
  const MovementResult({required this.part, required this.movement});

  final Part part;
  final InventoryMovement movement;

  factory MovementResult.fromJson(Map<String, dynamic> json) => MovementResult(
        part: Part.fromJson(json['part'] as Map<String, dynamic>),
        movement: InventoryMovement.fromJson(json['movement'] as Map<String, dynamic>),
      );
}
