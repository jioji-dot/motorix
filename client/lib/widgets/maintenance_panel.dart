import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/api_error.dart';
import '../models/maintenance.dart';
import '../providers/maintenance_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'confirm_dialog.dart';
import 'maintenance_dialog.dart';
import 'panel.dart';
import 'state_views.dart';
import 'status_chip.dart';

/// Panel "Mantenimiento" del detalle del vehículo: el mantenimiento pendiente con sus acciones
/// (según lo que el servidor permita al usuario) y los realizados o cancelados como antecedente.
class MaintenancePanel extends StatelessWidget {
  const MaintenancePanel({super.key, required this.vehicleId});

  final int vehicleId;

  Future<void> _run(BuildContext context, Future<Object?> Function() operacion, String exito) async {
    final MaintenanceProvider provider = context.read<MaintenanceProvider>();
    try {
      await operacion();
      if (context.mounted) showAppSnackBar(context, exito);
    } on ApiError catch (error) {
      if (context.mounted) showAppSnackBar(context, error.message, isError: true);
    }
    await provider.loadForVehicle(vehicleId);
  }

  Future<void> _edit(BuildContext context, Maintenance m) async {
    final MaintenanceInput? datos = await showMaintenanceDialog(context, existing: m);
    if (datos == null || !context.mounted) return;
    final bool cambiaDescripcion = datos.description != m.description;
    final bool cambiaFecha = datos.nextDate != m.nextDate;
    final bool cambiaKm = datos.nextMileage != m.nextMileage;
    if (!cambiaDescripcion && !cambiaFecha && !cambiaKm) return;
    final MaintenanceProvider provider = context.read<MaintenanceProvider>();
    await _run(
      context,
      () => provider.update(
        m.id,
        description: cambiaDescripcion ? datos.description : null,
        nextDate: cambiaFecha ? datos.nextDate : null,
        clearDate: cambiaFecha && datos.nextDate == null,
        nextMileage: cambiaKm ? datos.nextMileage : null,
        clearMileage: cambiaKm && datos.nextMileage == null,
      ),
      'Mantenimiento actualizado correctamente.',
    );
  }

  Future<void> _close(BuildContext context, Maintenance m, {required bool complete}) async {
    final bool confirmar = await showConfirmDialog(
      context,
      title: complete ? 'Mantenimiento realizado' : 'Cancelar el mantenimiento',
      message: complete
          ? '¿Seguro que quieres marcar "${m.description}" como realizado? Se conservará como antecedente.'
          : confirmationText('cancelar el mantenimiento "${m.description}"', irreversible: false),
      confirmLabel: complete ? 'Marcar como realizado' : 'Cancelar mantenimiento',
      cancelLabel: 'Volver',
    );
    if (!confirmar || !context.mounted) return;
    final MaintenanceProvider provider = context.read<MaintenanceProvider>();
    await _run(
      context,
      () => complete ? provider.complete(m.id) : provider.cancel(m.id),
      complete ? 'Mantenimiento marcado como realizado.' : 'Mantenimiento cancelado.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final MaintenanceProvider provider = context.watch<MaintenanceProvider>();
    final List<Maintenance>? items = provider.vehicleItems;

    if (provider.vehicleError != null) {
      return Panel(
        child: SizedBox(
          height: 140,
          child: ErrorStateView(
            message: provider.vehicleError!,
            onRetry: () => provider.loadForVehicle(vehicleId),
          ),
        ),
      );
    }
    if (items == null) {
      return const Panel(child: SizedBox(height: 100, child: LoadingView()));
    }

    final Maintenance? pendiente = provider.pending;
    final List<Maintenance> cerrados = items.where((Maintenance m) => !m.isPending).toList();
    final TextTheme text = Theme.of(context).textTheme;

    return Panel(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (pendiente == null)
            Text(
              'No hay un mantenimiento programado. El mecánico lo registra desde una orden terminada.',
              style: text.bodySmall,
            )
          else
            _PendingView(
              m: pendiente,
              onEdit: () => _edit(context, pendiente),
              onComplete: () => _close(context, pendiente, complete: true),
              onCancel: () => _close(context, pendiente, complete: false),
            ),
          if (cerrados.isNotEmpty) ...<Widget>[
            const SizedBox(height: AppSpacing.lg),
            Text('Antecedentes', style: text.titleSmall),
            const SizedBox(height: AppSpacing.sm),
            for (final Maintenance m in cerrados)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: <Widget>[
                    Expanded(child: Text(m.description, style: text.bodyMedium)),
                    Text(_target(m), style: text.bodySmall),
                    const SizedBox(width: AppSpacing.md),
                    StatusChip(
                      label: m.status.label,
                      color: m.status == MaintenanceStatus.done ? AppColors.success : AppColors.textSecondary,
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// Texto con la fecha y/o el kilometraje objetivo.
String _target(Maintenance m) {
  final List<String> partes = <String>[
    if (m.nextDate != null) Format.dateOnly(m.nextDate),
    if (m.nextMileage != null) Format.mileage(m.nextMileage!),
  ];
  return partes.join(' · ');
}

class _PendingView extends StatelessWidget {
  const _PendingView({
    required this.m,
    required this.onEdit,
    required this.onComplete,
    required this.onCancel,
  });

  final Maintenance m;
  final VoidCallback onEdit;
  final VoidCallback onComplete;
  final VoidCallback onCancel;

  String? get _restante {
    final List<String> partes = <String>[];
    if (m.daysRemaining != null) {
      final int d = m.daysRemaining!;
      partes.add(d < 0 ? 'venció hace ${-d} día${d == -1 ? '' : 's'}' : d == 0 ? 'hoy' : 'faltan $d día${d == 1 ? '' : 's'}');
    }
    if (m.kmRemaining != null) {
      final int k = m.kmRemaining!;
      partes.add(k < 0 ? 'excedido por ${Format.mileage(-k)}' : 'faltan ${Format.mileage(k)}');
    }
    return partes.isEmpty ? null : partes.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final MaintenanceClassification? clase = m.classification;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(child: Text(m.description, style: text.titleMedium)),
            if (clase != null) StatusChip(label: clase.label, color: clase.color),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.xl,
          runSpacing: AppSpacing.xs,
          children: <Widget>[
            Text('Objetivo: ${_target(m)}', style: text.bodyMedium),
            if (_restante != null) Text(_restante!, style: text.bodySmall),
            Text('Programado desde ${m.orderFolio}', style: text.bodySmall),
          ],
        ),
        if (m.canManage) ...<Widget>[
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: <Widget>[
              FilledButton.icon(
                onPressed: onComplete,
                icon: const Icon(LucideIcons.check, size: 18),
                label: const Text('Marcar como realizado'),
              ),
              OutlinedButton.icon(
                onPressed: onEdit,
                icon: const Icon(LucideIcons.pencil, size: 18),
                label: const Text('Editar'),
              ),
              OutlinedButton.icon(
                onPressed: onCancel,
                icon: const Icon(LucideIcons.ban, size: 18),
                label: const Text('Cancelar mantenimiento'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
