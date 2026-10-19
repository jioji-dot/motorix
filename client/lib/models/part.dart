/// Refacción del catálogo. `purchasePrice` solo lo envía el servidor al administrador.
class Part {
  const Part({
    required this.id,
    required this.code,
    required this.name,
    required this.category,
    required this.brand,
    required this.stock,
    required this.minimumStock,
    required this.salePrice,
    required this.active,
    this.stockLevel,
    this.purchasePrice,
  });

  final int id;
  final String code;
  final String name;
  final String category;
  final String brand;
  final int stock;
  final int minimumStock;

  /// OK, LOW u OUT; nulo si la refacción está desactivada.
  final String? stockLevel;
  final String salePrice;
  final String? purchasePrice;
  final bool active;

  factory Part.fromJson(Map<String, dynamic> json) => Part(
        id: json['id'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        category: json['category'] as String,
        brand: json['brand'] as String,
        stock: json['stock'] as int,
        minimumStock: json['minimumStock'] as int,
        stockLevel: json['stockLevel'] as String?,
        salePrice: json['salePrice'].toString(),
        purchasePrice: json['purchasePrice']?.toString(),
        active: json['active'] == true || json['active'] == 1,
      );
}

/// Movimiento de inventario (inmutable). `quantity` es el cambio de stock con signo.
class InventoryMovement {
  const InventoryMovement({
    required this.id,
    required this.type,
    required this.quantity,
    required this.stockAfter,
    required this.reason,
    required this.createdByName,
    required this.createdAt,
    this.orderId,
    this.orderFolio,
  });

  final int id;

  /// IN, OUT o ADJUSTMENT.
  final String type;
  final int quantity;
  final int stockAfter;
  final String reason;
  final int? orderId;
  final String? orderFolio;
  final String createdByName;
  final DateTime createdAt;

  factory InventoryMovement.fromJson(Map<String, dynamic> json) => InventoryMovement(
        id: json['id'] as int,
        type: json['type'] as String,
        quantity: json['quantity'] as int,
        stockAfter: json['stockAfter'] as int,
        reason: json['reason'] as String,
        orderId: json['orderId'] as int?,
        orderFolio: json['orderFolio'] as String?,
        createdByName: (json['createdBy'] as Map<String, dynamic>)['name'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      );
}

/// Detalle de una refacción con sus movimientos más recientes.
class PartDetail {
  const PartDetail({required this.part, required this.movements});

  final Part part;
  final List<InventoryMovement> movements;

  factory PartDetail.fromJson(Map<String, dynamic> json) => PartDetail(
        part: Part.fromJson(json),
        movements: ((json['movements'] as List?) ?? const [])
            .map((m) => InventoryMovement.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
}

/// Resumen de alertas de stock (solo refacciones activas).
class StockSummary {
  const StockSummary({required this.total, required this.ok, required this.low, required this.out});

  final int total;
  final int ok;
  final int low;
  final int out;

  bool get hasAlerts => low > 0 || out > 0;

  factory StockSummary.fromJson(Map<String, dynamic> json) => StockSummary(
        total: json['total'] as int,
        ok: json['ok'] as int,
        low: json['low'] as int,
        out: json['out'] as int,
      );
}
