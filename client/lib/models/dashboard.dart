import 'part.dart';

/// Órdenes por estado y entregadas hoy.
class DashboardOrders {
  const DashboardOrders({
    required this.received,
    required this.diagnosis,
    required this.inRepair,
    required this.waitingPart,
    required this.finishedNotDelivered,
    required this.deliveredToday,
  });

  final int received;
  final int diagnosis;
  final int inRepair;
  final int waitingPart;
  final int finishedNotDelivered;
  final int deliveredToday;

  /// Órdenes abiertas (aún en el taller, sin terminar).
  int get open => received + diagnosis + inRepair + waitingPart;

  factory DashboardOrders.fromJson(Map<String, dynamic> json) => DashboardOrders(
        received: json['received'] as int,
        diagnosis: json['diagnosis'] as int,
        inRepair: json['inRepair'] as int,
        waitingPart: json['waitingPart'] as int,
        finishedNotDelivered: json['finishedNotDelivered'] as int,
        deliveredToday: json['deliveredToday'] as int,
      );
}

/// Siguiente cita pendiente o confirmada.
class DashboardNextAppointment {
  const DashboardNextAppointment({
    required this.id,
    required this.scheduledAt,
    required this.clientName,
    required this.vehiclePlate,
    required this.reason,
  });

  final int id;

  /// Hora local de pared `YYYY-MM-DDTHH:mm`.
  final String scheduledAt;
  final String clientName;
  final String vehiclePlate;
  final String reason;

  factory DashboardNextAppointment.fromJson(Map<String, dynamic> json) => DashboardNextAppointment(
        id: json['id'] as int,
        scheduledAt: json['scheduledAt'] as String,
        clientName: json['clientName'] as String,
        vehiclePlate: json['vehiclePlate'] as String,
        reason: (json['reason'] as String?) ?? '',
      );
}

class DashboardAppointments {
  const DashboardAppointments({required this.today, required this.next7Days, this.next});

  final int today;
  final int next7Days;
  final DashboardNextAppointment? next;

  factory DashboardAppointments.fromJson(Map<String, dynamic> json) => DashboardAppointments(
        today: json['today'] as int,
        next7Days: json['next7Days'] as int,
        next: json['next'] == null
            ? null
            : DashboardNextAppointment.fromJson(json['next'] as Map<String, dynamic>),
      );
}

class DashboardMaintenance {
  const DashboardMaintenance({
    required this.overdue,
    required this.upcoming,
    required this.warningDays,
    required this.warningKm,
  });

  final int overdue;
  final int upcoming;
  final int warningDays;
  final int warningKm;

  factory DashboardMaintenance.fromJson(Map<String, dynamic> json) => DashboardMaintenance(
        overdue: json['overdue'] as int,
        upcoming: json['upcoming'] as int,
        warningDays: json['warningDays'] as int,
        warningKm: json['warningKm'] as int,
      );
}

/// Refacción activa con stock bajo o agotada.
class DashboardCriticalPart {
  const DashboardCriticalPart({
    required this.id,
    required this.code,
    required this.name,
    required this.stock,
    required this.minimumStock,
    required this.stockStatus,
  });

  final int id;
  final String code;
  final String name;
  final int stock;
  final int minimumStock;
  final StockStatus stockStatus;

  factory DashboardCriticalPart.fromJson(Map<String, dynamic> json) => DashboardCriticalPart(
        id: json['id'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        stock: json['stock'] as int,
        minimumStock: json['minimumStock'] as int,
        stockStatus: StockStatus.fromApi(json['stockStatus'] as String),
      );
}

class DashboardInventory {
  const DashboardInventory({required this.low, required this.out, required this.critical});

  final int low;
  final int out;
  final List<DashboardCriticalPart> critical;

  factory DashboardInventory.fromJson(Map<String, dynamic> json) => DashboardInventory(
        low: json['low'] as int,
        out: json['out'] as int,
        critical: (json['critical'] as List<dynamic>)
            .map((dynamic p) => DashboardCriticalPart.fromJson(p as Map<String, dynamic>))
            .toList(),
      );
}

class DashboardPayments {
  const DashboardPayments({
    required this.collectedToday,
    required this.pendingBalance,
    required this.ordersToCollect,
  });

  final double collectedToday;
  final double pendingBalance;
  final int ordersToCollect;

  factory DashboardPayments.fromJson(Map<String, dynamic> json) => DashboardPayments(
        collectedToday: (json['collectedToday'] as num).toDouble(),
        pendingBalance: (json['pendingBalance'] as num).toDouble(),
        ordersToCollect: json['ordersToCollect'] as int,
      );
}

/// Indicadores del panel de control (solo administración).
class Dashboard {
  const Dashboard({
    required this.generatedAt,
    required this.orders,
    required this.appointments,
    required this.maintenance,
    required this.inventory,
    required this.payments,
  });

  final DateTime? generatedAt;
  final DashboardOrders orders;
  final DashboardAppointments appointments;
  final DashboardMaintenance maintenance;
  final DashboardInventory inventory;
  final DashboardPayments payments;

  factory Dashboard.fromJson(Map<String, dynamic> json) => Dashboard(
        generatedAt: json['generatedAt'] == null ? null : DateTime.tryParse(json['generatedAt'] as String),
        orders: DashboardOrders.fromJson(json['orders'] as Map<String, dynamic>),
        appointments: DashboardAppointments.fromJson(json['appointments'] as Map<String, dynamic>),
        maintenance: DashboardMaintenance.fromJson(json['maintenance'] as Map<String, dynamic>),
        inventory: DashboardInventory.fromJson(json['inventory'] as Map<String, dynamic>),
        payments: DashboardPayments.fromJson(json['payments'] as Map<String, dynamic>),
      );
}
