import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/sidebar_provider.dart';
import '../utils/app_theme.dart';

/// Sección de la barra lateral.
class ShellSection {
  const ShellSection({required this.label, required this.icon, required this.roles});

  final String label;
  final IconData icon;

  /// Roles que pueden ver la sección (los permisos también se validan en el backend).
  final Set<UserRole> roles;
}

/// Diseño base: barra lateral colapsable + encabezado + contenido (docs/design-system.md, sección 7).
class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.user,
    required this.sections,
    required this.selectedIndex,
    required this.onSelect,
    required this.onChangePassword,
    required this.onLogout,
    required this.child,
  });

  final User user;

  /// Secciones ya filtradas por el rol del usuario.
  final List<ShellSection> sections;
  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final VoidCallback onChangePassword;
  final VoidCallback onLogout;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final sidebar = context.watch<SidebarProvider>();
    sidebar.initForWidth(MediaQuery.sizeOf(context).width);
    final expandida = sidebar.expanded;

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: expandida,
            minWidth: 72,
            minExtendedWidth: 260,
            selectedIndex: selectedIndex,
            onDestinationSelected: onSelect,
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: expandida ? 'Contraer menú' : 'Expandir menú',
                    onPressed: sidebar.toggle,
                    icon: const Icon(LucideIcons.menu, color: AppColors.onSidebar, size: 20),
                  ),
                  if (expandida) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Motorix',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(color: AppColors.onSidebar),
                    ),
                  ],
                ],
              ),
            ),
            destinations: [
              for (final seccion in sections)
                NavigationRailDestination(
                  icon: Tooltip(message: seccion.label, child: Icon(seccion.icon)),
                  label: Text(seccion.label),
                ),
            ],
            trailing: Expanded(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                  child: _UserMenu(
                    user: user,
                    expanded: expandida,
                    onChangePassword: onChangePassword,
                    onLogout: onLogout,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: Column(
              children: [
                _Header(title: sections[selectedIndex].label, user: user),
                const Divider(),
                Expanded(child: child),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.user});

  final String title;
  final User user;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.lg),
      child: Row(
        children: [
          Expanded(child: Text(title, style: texto.titleLarge)),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(user.name, style: texto.titleSmall),
              Text(user.role.label, style: texto.bodySmall),
            ],
          ),
        ],
      ),
    );
  }
}

class _UserMenu extends StatelessWidget {
  const _UserMenu({
    required this.user,
    required this.expanded,
    required this.onChangePassword,
    required this.onLogout,
  });

  final User user;
  final bool expanded;
  final VoidCallback onChangePassword;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return PopupMenuButton<String>(
      tooltip: 'Menú de usuario',
      onSelected: (valor) => valor == 'password' ? onChangePassword() : onLogout(),
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'password', child: Text('Cambiar contraseña')),
        PopupMenuItem(value: 'logout', child: Text('Cerrar sesión')),
      ],
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.circleUser, color: AppColors.onSidebar, size: 24),
            if (expanded) ...[
              const SizedBox(width: AppSpacing.md),
              SizedBox(
                width: 150,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name,
                      overflow: TextOverflow.ellipsis,
                      style: texto.titleSmall?.copyWith(color: AppColors.onSidebar),
                    ),
                    Text(
                      user.role.label,
                      style: texto.bodySmall?.copyWith(color: AppColors.onSidebarMuted),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
