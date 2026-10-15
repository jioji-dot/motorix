import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Estado de un mantenimiento programado.
enum MaintenanceStatus {
  pending('PENDIENTE', 'Pendiente'),
  done('REALIZADO', 'Realizado'),
  cancelled('CANCELADO', 'Cancelado');

  const MaintenanceStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static MaintenanceStatus fromApi(String valor) => MaintenanceStatus.values
      .firstWhere((MaintenanceStatus s) => s.apiValue == valor, orElse: () => pending);
}

/// Clasificación calculada por el servidor para un mantenimiento pendiente.
enum MaintenanceClassification {
  overdue('OVERDUE', 'Vencido', AppColors.danger),
  upcoming('UPCOMING', 'Próximo', AppColors.warning),
  later('LATER', 'Lejano', AppColors.textSecondary);

  const MaintenanceClassification(this.apiValue, this.label, this.color);

  final String apiValue;
  final String label;
  final Color color;

  static MaintenanceClassification? fromApi(String? valor) {
    if (valor == null) return null;
    return MaintenanceClassification.values
        .firstWhere((MaintenanceClassification c) => c.apiValue == valor, orElse: () => later);
  }
}

/// Próximo mantenimiento de un vehículo, programado por fecha, por kilometraje o por ambos.
class Maintenance {
  const Maintenance({
    required this.id,
    required this.vehicleId,
    required this.vehiclePlate,
    required this.vehicleTitle,
    required this.clientId,
    required this.clientName,
    required this.clientPhone,
    required this.orderId,
    required this.orderFolio,
    required this.description,
    required this.currentMileage,
    required this.status,
    required this.canManage,
    this.nextDate,
    this.nextMileage,
    this.classification,
    this.daysRemaining,
    this.kmRemaining,
  });

  final int id;
  final int vehicleId;
  final String vehiclePlate;
  final String vehicleTitle;
  final int clientId;
  final String clientName;
  final String clientPhone;
  final int orderId;
  final String orderFolio;
  final String description;

  /// Fecha objetivo `YYYY-MM-DD`.
  final String? nextDate;
  final int? nextMileage;
  final int currentMileage;
  final MaintenanceStatus status;
  final MaintenanceClassification? classification;

  /// Días que faltan (negativo si ya venció); null si no hay fecha.
  final int? daysRemaining;
  final int? kmRemaining;

  /// El usuario puede editarlo o cerrarlo ahora (lo calcula el servidor).
  final bool canManage;

  bool get isPending => status == MaintenanceStatus.pending;

  factory Maintenance.fromJson(Map<String, dynamic> json) => Maintenance(
        id: json['id'] as int,
        vehicleId: json['vehicleId'] as int,
        vehiclePlate: json['vehiclePlate'] as String,
        vehicleTitle: json['vehicleTitle'] as String,
        clientId: json['clientId'] as int,
        clientName: json['clientName'] as String,
        clientPhone: (json['clientPhone'] as String?) ?? '',
        orderId: json['orderId'] as int,
        orderFolio: (json['orderFolio'] as String?) ?? '',
        description: json['description'] as String,
        nextDate: json['nextDate'] as String?,
        nextMileage: json['nextMileage'] as int?,
        currentMileage: json['currentMileage'] as int,
        status: MaintenanceStatus.fromApi(json['status'] as String),
        classification: MaintenanceClassification.fromApi(json['classification'] as String?),
        daysRemaining: json['daysRemaining'] as int?,
        kmRemaining: json['kmRemaining'] as int?,
        canManage: (json['canManage'] as bool?) ?? false,
      );
}

/// Qué mantenimientos muestra el listado de avisos. Los valores se envían como parámetros de la API.
enum MaintenanceFilter {
  alert('Vencidos y próximos', classification: 'ALERT'),
  overdue('Solo vencidos', classification: 'OVERDUE'),
  upcoming('Solo próximos', classification: 'UPCOMING'),
  allPending('Todos los pendientes', status: 'PENDIENTE'),
  done('Realizados', status: 'REALIZADO'),
  cancelled('Cancelados', status: 'CANCELADO');

  const MaintenanceFilter(this.label, {this.classification, this.status});

  final String label;
  final String? classification;
  final String? status;
}

/// Datos capturados en el diálogo de mantenimiento.
class MaintenanceInput {
  const MaintenanceInput({required this.description, this.nextDate, this.nextMileage});

  final String description;
  final String? nextDate;
  final int? nextMileage;
}
