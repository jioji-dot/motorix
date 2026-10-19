import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Chip de estado con color plano según la convención del sistema de diseño.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.color});

  factory StatusChip.active(bool active) => StatusChip(
        label: active ? 'Activo' : 'Inactivo',
        color: active ? AppColors.success : AppColors.textSecondary,
      );

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
