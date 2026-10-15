import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Estados de la orden de servicio. Los colores siguen `docs/design-system.md` (sección 5).
enum OrderStatus {
  received('RECIBIDO', 'Recibido', AppColors.textSecondary),
  diagnosis('DIAGNOSTICO', 'Diagnóstico', AppColors.warning),
  inRepair('EN_REPARACION', 'En reparación', AppColors.primary),
  waitingPart('ESPERANDO_REFACCION', 'Esperando refacción', AppColors.warning),
  finished('TERMINADO', 'Terminado', AppColors.success),
  delivered('ENTREGADO', 'Entregado', AppColors.success);

  const OrderStatus(this.apiValue, this.label, this.color);

  final String apiValue;
  final String label;
  final Color color;

  static OrderStatus fromApi(String valor) => OrderStatus.values.firstWhere(
        (OrderStatus e) => e.apiValue == valor,
        orElse: () => OrderStatus.received,
      );

  /// La orden ya no admite cambios de diagnóstico, servicios ni mano de obra.
  bool get isClosedForWork => this == OrderStatus.finished || this == OrderStatus.delivered;
}

/// Estados de la cita.
enum AppointmentStatus {
  pending('PENDIENTE', 'Pendiente', AppColors.textSecondary),
  confirmed('CONFIRMADA', 'Confirmada', AppColors.primary),
  inProgress('EN_PROCESO', 'En proceso', AppColors.warning),
  completed('COMPLETADA', 'Completada', AppColors.success),
  cancelled('CANCELADA', 'Cancelada', AppColors.danger);

  const AppointmentStatus(this.apiValue, this.label, this.color);

  final String apiValue;
  final String label;
  final Color color;

  static AppointmentStatus fromApi(String valor) => AppointmentStatus.values.firstWhere(
        (AppointmentStatus e) => e.apiValue == valor,
        orElse: () => AppointmentStatus.pending,
      );

  /// La cita todavía se puede modificar, confirmar o cancelar.
  bool get isOpen => this == AppointmentStatus.pending || this == AppointmentStatus.confirmed;
}
