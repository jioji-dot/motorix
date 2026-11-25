import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client_notice.dart';
import '../providers/client_notices_provider.dart';
import '../providers/notifications_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';

/// Color del chip de cada motivo.
const _coloresDeMotivo = <String, Color>{
  'ORDEN_LISTA': AppColors.success,
  'CITA_MANANA': AppColors.primary,
  'MANTENIMIENTO_PROXIMO': AppColors.warning,
  'MANTENIMIENTO_VENCIDO': AppColors.danger,
};

/// Clientes por avisar (Sprint 6): vehículo listo, cita de mañana y mantenimientos próximos o vencidos.
/// La aplicación no envía mensajes: la persona llama o avisa en persona y luego lo marca como avisado.
class ClientNoticesScreen extends StatefulWidget {
  const ClientNoticesScreen({super.key});

  @override
  State<ClientNoticesScreen> createState() => _ClientNoticesScreenState();
}

class _ClientNoticesScreenState extends State<ClientNoticesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ClientNoticesProvider>().load(page: 1);
    });
  }

  Future<void> _marcar(PendingClientNotice hecho) async {
    final nota = await showDialog<String>(context: context, builder: (_) => _DialogoDeAviso(hecho: hecho));
    if (nota == null || !mounted) return; // canceló
    final provider = context.read<ClientNoticesProvider>();
    final notificaciones = context.read<NotificationsProvider>();
    final mensaje = await provider.markNoticed(hecho, note: nota);
    notificaciones.refresh(silent: true);
    if (!mounted) return;
    if (mensaje == null) {
      showFeedback(context, '${hecho.clientName} quedó registrado como avisado.');
    } else {
      showFeedback(context, mensaje, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ClientNoticesProvider>();
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Esta lista indica a quién avisar. La aplicación no envía mensajes: llama o avisa en persona y luego marca al cliente como avisado.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(child: _cuerpo(provider)),
        ],
      ),
    );
  }

  Widget _cuerpo(ClientNoticesProvider provider) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando clientes por avisar...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);
    if (provider.items.isEmpty) {
      return const EmptyState(
        icon: LucideIcons.phoneCall,
        title: 'No hay clientes por avisar',
        message: 'Aquí aparecerán los vehículos listos, las citas de mañana y los mantenimientos próximos o vencidos.',
      );
    }
    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: 1000,
            showCheckboxColumn: false,
            columns: const [
              DataColumn2(label: Text('Motivo'), size: ColumnSize.M),
              DataColumn2(label: Text('Cliente'), size: ColumnSize.M),
              DataColumn2(label: Text('Teléfono'), size: ColumnSize.S),
              DataColumn2(label: Text('Vehículo'), size: ColumnSize.M),
              DataColumn2(label: Text('Detalle'), size: ColumnSize.L),
              DataColumn2(label: Text('Fecha'), size: ColumnSize.S),
              DataColumn2(label: Text('Acciones'), fixedWidth: 170),
            ],
            rows: [
              for (final h in provider.items)
                DataRow2(
                  key: ValueKey('${h.kind}:${h.factId}'),
                  cells: [
                    DataCell(StatusChip(label: h.reason, color: _coloresDeMotivo[h.kind] ?? AppColors.textSecondary)),
                    DataCell(Text(h.clientName, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(h.phone.isEmpty ? '—' : formatPhone(h.phone), overflow: TextOverflow.ellipsis)),
                    DataCell(Text('${h.licensePlate} · ${h.vehicleTitle}', overflow: TextOverflow.ellipsis)),
                    DataCell(Text(h.detail, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(h.factDate == null ? '—' : formatDate(h.factDate!), overflow: TextOverflow.ellipsis)),
                    DataCell(
                      OutlinedButton(
                        key: Key('avisado-${h.kind}-${h.factId}'),
                        onPressed: () => _marcar(h),
                        child: const Text('Marcar como avisado'),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${provider.total} cliente${provider.total == 1 ? '' : 's'} por avisar',
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              IconButton(
                tooltip: 'Página anterior',
                onPressed: provider.page > 1 ? () => provider.load(page: provider.page - 1) : null,
                icon: const Icon(LucideIcons.chevronLeft, size: 18),
              ),
              Text('${provider.page} de ${provider.totalPages}'),
              IconButton(
                tooltip: 'Página siguiente',
                onPressed: provider.page < provider.totalPages ? () => provider.load(page: provider.page + 1) : null,
                icon: const Icon(LucideIcons.chevronRight, size: 18),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Diálogo con la nota opcional (hasta 255 caracteres). Devuelve el texto de la nota, o nulo si se cancela.
class _DialogoDeAviso extends StatefulWidget {
  const _DialogoDeAviso({required this.hecho});

  final PendingClientNotice hecho;

  @override
  State<_DialogoDeAviso> createState() => _DialogoDeAvisoState();
}

class _DialogoDeAvisoState extends State<_DialogoDeAviso> {
  final _nota = TextEditingController();

  @override
  void dispose() {
    _nota.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Marcar como avisado'),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${widget.hecho.clientName} · ${widget.hecho.reason}'),
            const SizedBox(height: AppSpacing.md),
            TextField(
              key: const Key('campo-nota-aviso'),
              controller: _nota,
              maxLength: 255,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Nota (opcional)', hintText: 'Por ejemplo: no contestó, se dejó recado'),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: () => Navigator.of(context).pop(_nota.text), child: const Text('Confirmar')),
      ],
    );
  }
}
