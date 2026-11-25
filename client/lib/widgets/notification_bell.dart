import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/notification.dart';
import '../providers/notifications_provider.dart';
import 'notifications_panel.dart';

/// Campana del encabezado: muestra cuántos avisos no leídos hay y abre el panel (Sprint 6, FR-001).
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, required this.onOpenNotice});

  /// Lleva a la pantalla relacionada con el aviso (FR-010).
  final ValueChanged<NoticeTarget> onOpenNotice;

  /// Texto del contador: «99+» cuando pasa de 99.
  static String countLabel(int unread) => unread > 99 ? '99+' : '$unread';

  @override
  Widget build(BuildContext context) {
    final unread = context.select<NotificationsProvider, int>((p) => p.unread);
    return Badge(
      isLabelVisible: unread > 0,
      label: Text(countLabel(unread), key: const Key('contador-avisos')),
      offset: const Offset(-4, 4),
      child: IconButton(
        key: const Key('campana'),
        tooltip: 'Notificaciones',
        icon: const Icon(LucideIcons.bell),
        onPressed: () => showNotificationsPanel(context, onOpenNotice: onOpenNotice),
      ),
    );
  }
}
