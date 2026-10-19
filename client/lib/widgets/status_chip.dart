import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Estados de las citas (valores de la API) con su etiqueta y color (docs/design-system.md, sección 5).
const _estadosCita = <String, (String, Color)>{
  'PENDIENTE': ('Pendiente', AppColors.textSecondary),
  'CONFIRMADA': ('Confirmada', AppColors.primary),
  'EN_PROCESO': ('En proceso', AppColors.warning),
  'COMPLETADA': ('Completada', AppColors.success),
  'CANCELADA': ('Cancelada', AppColors.danger),
};

/// Estados de las órdenes de servicio.
const _estadosOrden = <String, (String, Color)>{
  'RECIBIDO': ('Recibido', AppColors.textSecondary),
  'DIAGNOSTICO': ('Diagnóstico', AppColors.warning),
  'EN_REPARACION': ('En reparación', AppColors.primary),
  'ESPERANDO_REFACCION': ('Esperando refacción', AppColors.warning),
  'TERMINADO': ('Terminado', AppColors.success),
  'ENTREGADO': ('Entregado', AppColors.success),
  'CANCELADA': ('Cancelada', AppColors.danger),
};

/// Nivel de stock de una refacción (Sprint 3).
const _nivelesDeStock = <String, (String, Color)>{
  'OK': ('En orden', AppColors.success),
  'LOW': ('Stock bajo', AppColors.warning),
  'OUT': ('Agotada', AppColors.danger),
};

/// Clasificación de un mantenimiento programado (Sprint 3).
const _clasificaciones = <String, (String, Color)>{
  'NORMAL': ('Normal', AppColors.textSecondary),
  'PROXIMO': ('Próximo', AppColors.warning),
  'VENCIDO': ('Vencido', AppColors.danger),
};

/// Etiqueta en español de un nivel de stock.
String stockLevelLabel(String nivel) => _nivelesDeStock[nivel]?.$1 ?? nivel;

/// Etiqueta en español de la clasificación de un mantenimiento.
String maintenanceClassLabel(String clase) => _clasificaciones[clase]?.$1 ?? clase;

/// Etiqueta en español de un estado de cita.
String appointmentStatusLabel(String estado) => _estadosCita[estado]?.$1 ?? estado;

/// Etiqueta en español de un estado de orden.
String orderStatusLabel(String estado) => _estadosOrden[estado]?.$1 ?? estado;

/// Chip de estado con color plano según la convención del sistema de diseño.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.color});

  factory StatusChip.active(bool active) => StatusChip(
        label: active ? 'Activo' : 'Inactivo',
        color: active ? AppColors.success : AppColors.textSecondary,
      );

  factory StatusChip.appointment(String estado) {
    final datos = _estadosCita[estado];
    return StatusChip(label: datos?.$1 ?? estado, color: datos?.$2 ?? AppColors.textSecondary);
  }

  factory StatusChip.order(String estado) {
    final datos = _estadosOrden[estado];
    return StatusChip(label: datos?.$1 ?? estado, color: datos?.$2 ?? AppColors.textSecondary);
  }

  /// Nivel de stock; una refacción desactivada (sin nivel) se muestra como Inactiva.
  factory StatusChip.stock(String? nivel) {
    if (nivel == null) return const StatusChip(label: 'Inactiva', color: AppColors.textSecondary);
    final datos = _nivelesDeStock[nivel];
    return StatusChip(label: datos?.$1 ?? nivel, color: datos?.$2 ?? AppColors.textSecondary);
  }

  /// Clasificación del mantenimiento; los atendidos (sin clasificación) se muestran como Atendido.
  factory StatusChip.maintenance(String? clase) {
    if (clase == null) return const StatusChip(label: 'Atendido', color: AppColors.success);
    final datos = _clasificaciones[clase];
    return StatusChip(label: datos?.$1 ?? clase, color: datos?.$2 ?? AppColors.textSecondary);
  }

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppMotion.state,
      curve: AppMotion.curve,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.panel),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(color: color),
      ),
    );
  }
}
