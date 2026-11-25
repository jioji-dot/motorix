import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/notification.dart';
import '../providers/notifications_provider.dart';
import '../utils/app_theme.dart';
import 'state_views.dart';
import 'status_chip.dart';

/// Etiqueta y color del chip de cada tipo de aviso (docs/design-system.md, sección 8.8).
const _chipsPorTipo = <String, (String, Color)>{
  'MAINTENANCE_OVERDUE': ('Vencido', AppColors.danger),
  'MAINTENANCE_SOON': ('Próximo', AppColors.warning),
  'APPOINTMENT_TODAY': ('Hoy', AppColors.textSecondary),
  'STOCK_OUT': ('Agotada', AppColors.danger),
  'STOCK_LOW': ('Stock bajo', AppColors.warning),
  'ORDER_STALLED': ('Detenida', AppColors.danger),
};

/// Abre el panel de avisos bajo la campana. Escape o tocar fuera lo cierra.
Future<void> showNotificationsPanel(
  BuildContext context, {
  required ValueChanged<NoticeTarget> onOpenNotice,
}) {
  context.read<NotificationsProvider>().refresh(silent: true);
  return showDialog<void>(
    context: context,
    barrierColor: Colors.black26,
    builder: (dialogContext) => Align(
      alignment: Alignment.topRight,
      child: Padding(
        padding: const EdgeInsets.only(top: 64, right: AppSpacing.lg),
        child: NotificationsPanel(
          onOpenNotice: (destino) {
            Navigator.of(dialogContext).pop();
            onOpenNotice(destino);
          },
          onClose: () => Navigator.of(dialogContext).pop(),
        ),
      ),
    ),
  );
}

/// Contenido del panel: avisos agrupados por tipo con los estados de carga, vacío y error.
class NotificationsPanel extends StatelessWidget {
  const NotificationsPanel({
    super.key,
    required this.onOpenNotice,
    required this.onClose,
  });

  final ValueChanged<NoticeTarget> onOpenNotice;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationsProvider>();
    return Material(
      key: const Key('panel-de-avisos'),
      color: AppColors.surface,
      elevation: 6,
      borderRadius: BorderRadius.circular(AppRadius.panel),
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          maxWidth: 440,
          maxHeight: 560,
          minWidth: 340,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Notificaciones',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  TextButton(onPressed: onClose, child: const Text('Cerrar')),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(child: _contenido(context, provider)),
          ],
        ),
      ),
    );
  }

  Widget _contenido(BuildContext context, NotificationsProvider provider) {
    final data = provider.data;
    if (data == null && provider.loading) {
      return const SizedBox(
        height: 160,
        child: LoadingState(message: 'Cargando avisos...'),
      );
    }
    if (data == null) {
      return SizedBox(
        height: 240,
        child: ErrorState(
          message: provider.error ?? 'No se pudieron cargar los avisos.',
          onRetry: () => provider.refresh(),
        ),
      );
    }
    if (data.groups.isEmpty) {
      return const SizedBox(
        height: 160,
        child: EmptyState(title: 'No tienes avisos pendientes'),
      );
    }
    // Como mucho 6 grupos de 10 avisos: una columna con desplazamiento basta y construye todo el contenido.
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final grupo in data.groups) ...[
            _EncabezadoDeGrupo(grupo: grupo),
            for (final aviso in grupo.items)
              _FilaDeAviso(
                aviso: aviso,
                onOpen: () => onOpenNotice(aviso.target),
                onMarkRead: () async {
                  final mensaje = await provider.markRead(aviso.key);
                  if (mensaje != null && context.mounted) {
                    showFeedback(context, mensaje, error: true);
                  }
                },
              ),
            if (grupo.hidden > 0)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.xs,
                ),
                child: Text(
                  'y ${grupo.hidden} más en el módulo',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _EncabezadoDeGrupo extends StatelessWidget {
  const _EncabezadoDeGrupo({required this.grupo});

  final NoticeGroup grupo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xs,
      ),
      child: Text(
        '${grupo.title} (${grupo.total})',
        style: Theme.of(context).textTheme.titleSmall,
      ),
    );
  }
}

class _FilaDeAviso extends StatelessWidget {
  const _FilaDeAviso({
    required this.aviso,
    required this.onOpen,
    required this.onMarkRead,
  });

  final AppNotice aviso;
  final VoidCallback onOpen;
  final VoidCallback onMarkRead;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final chip = _chipsPorTipo[aviso.type];
    final atenuado = aviso.read;
    return Padding(
      key: Key('aviso-${aviso.key}'),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  aviso.title,
                  style: texto.bodyLarge?.copyWith(
                    color: atenuado
                        ? AppColors.textSecondary
                        : AppColors.textPrimary,
                    fontWeight: atenuado ? FontWeight.w400 : FontWeight.w600,
                  ),
                ),
              ),
              if (chip != null) ...[
                const SizedBox(width: AppSpacing.sm),
                StatusChip(label: chip.$1, color: chip.$2),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(aviso.detail, style: texto.bodySmall),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (!aviso.read)
                TextButton(
                  key: Key('leer-${aviso.key}'),
                  onPressed: onMarkRead,
                  child: const Text('Marcar como leído'),
                ),
              TextButton(
                key: Key('abrir-${aviso.key}'),
                onPressed: onOpen,
                child: const Text('Abrir'),
              ),
            ],
          ),
          const Divider(height: 1),
        ],
      ),
    );
  }
}
