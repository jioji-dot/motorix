import 'package:flutter/material.dart';

import '../utils/app_theme.dart';
import 'panel.dart';

/// Tarjeta de un indicador del panel: título, cifra principal, detalle y acción opcional.
/// El color de la cifra indica el estado (ámbar: próximo o stock bajo, rojo: vencido o agotada,
/// verde: cobrado); sin color usa el texto principal.
class DashboardTile extends StatelessWidget {
  const DashboardTile({
    super.key,
    required this.title,
    required this.value,
    this.detail,
    this.color,
    this.actionLabel,
    this.onTap,
    this.emptyMessage,
  });

  final String title;

  /// Cifra principal ya formateada (por ejemplo `3` o `$1,200.00`).
  final String value;
  final String? detail;
  final Color? color;
  final String? actionLabel;
  final VoidCallback? onTap;

  /// Texto que reemplaza el detalle cuando no hay nada que mostrar.
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final Widget contenido = Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(title, style: text.bodySmall),
          const SizedBox(height: AppSpacing.sm),
          Text(value, style: text.headlineMedium?.copyWith(color: color)),
          if (emptyMessage != null || detail != null) ...<Widget>[
            const SizedBox(height: AppSpacing.xs),
            Text(emptyMessage ?? detail!, style: text.bodySmall),
          ],
          if (actionLabel != null) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            Text(
              actionLabel!,
              style: text.labelLarge?.copyWith(color: AppColors.primary),
            ),
          ],
        ],
      ),
    );

    return Semantics(
      button: onTap != null,
      label: '$title: $value',
      child: Panel(
        child: onTap == null
            ? contenido
            : InkWell(onTap: onTap, child: contenido),
      ),
    );
  }
}
