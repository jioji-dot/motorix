import 'part.dart';

/// Cita próxima que muestra el panel.
class DashboardAppointment {
  const DashboardAppointment({
    required this.id,
    required this.scheduledAt,
    required this.status,
    required this.clientName,
    required this.licensePlate,
    required this.reason,
  });

  final int id;
  final DateTime scheduledAt;
  final String status;
  final String clientName;
  final String licensePlate;
  final String reason;

  factory DashboardAppointment.fromJson(Map<String, dynamic> json) => DashboardAppointment(
        id: json['id'] as int,
        scheduledAt: DateTime.parse(json['scheduledAt'] as String).toLocal(),
        status: json['status'] as String,
        clientName: json['clientName'] as String,
        licensePlate: json['licensePlate'] as String,
        reason: json['reason'] as String,
      );
}

/// Cifras del panel de control: se calculan en el servidor al abrirlo; la aplicación no guarda copias.
class Dashboard {
  const Dashboard({
    required this.generatedAt,
    required this.ordersByStatus,
    required this.ordersWithBalance,
    required this.balanceAmount,
    required this.appointmentsToday,
    required this.appointmentsUpcoming,
    required this.nextAppointments,
    required this.maintenanceOverdue,
    required this.maintenanceSoon,
    required this.stockLow,
    required this.stockOut,
    required this.mostUrgentParts,
    required this.collectedToday,
    required this.collectedMonth,
    required this.pendingToCollect,
  });

  final DateTime generatedAt;
  final Map<String, int> ordersByStatus;
  final int ordersWithBalance;
  final String balanceAmount;
  final int appointmentsToday;
  final int appointmentsUpcoming;
  final List<DashboardAppointment> nextAppointments;
  final int maintenanceOverdue;
  final int maintenanceSoon;
  final int stockLow;
  final int stockOut;
  final List<Part> mostUrgentParts;
  final String collectedToday;
  final String collectedMonth;
  final String pendingToCollect;

  factory Dashboard.fromJson(Map<String, dynamic> json) {
    final ordenes = json['orders'] as Map<String, dynamic>;
    final saldo = ordenes['withBalance'] as Map<String, dynamic>;
    final citas = json['appointments'] as Map<String, dynamic>;
    final mantenimientos = json['maintenance'] as Map<String, dynamic>;
    final inventario = json['inventory'] as Map<String, dynamic>;
    final pagos = json['payments'] as Map<String, dynamic>;

    return Dashboard(
      generatedAt: DateTime.parse(json['generatedAt'] as String).toLocal(),
      ordersByStatus: (ordenes['byStatus'] as Map<String, dynamic>).map((k, v) => MapEntry(k, v as int)),
      ordersWithBalance: saldo['count'] as int,
      balanceAmount: saldo['amount'].toString(),
      appointmentsToday: citas['today'] as int,
      appointmentsUpcoming: citas['upcoming'] as int,
      nextAppointments: ((citas['next'] as List?) ?? const [])
          .map((c) => DashboardAppointment.fromJson(c as Map<String, dynamic>))
          .toList(),
      maintenanceOverdue: mantenimientos['overdue'] as int,
      maintenanceSoon: mantenimientos['soon'] as int,
      stockLow: inventario['low'] as int,
      stockOut: inventario['out'] as int,
      mostUrgentParts: ((inventario['mostUrgent'] as List?) ?? const [])
          .map((p) => Part.fromJson({'category': '', 'brand': '', 'salePrice': '0', 'active': true, ...(p as Map<String, dynamic>)}))
          .toList(),
      collectedToday: pagos['collectedToday'].toString(),
      collectedMonth: pagos['collectedMonth'].toString(),
      pendingToCollect: pagos['pendingToCollect'].toString(),
    );
  }
}
