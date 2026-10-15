import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../app_routes.dart';
import '../models/part.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/inventory_provider.dart';
import '../providers/sidebar_provider.dart';
import '../screens/change_password_screen.dart';
import '../utils/app_theme.dart';
import 'confirm_dialog.dart';

/// Elemento del menú lateral. Solo se muestran los módulos del sprint actual y del rol.
class NavItem {
  const NavItem({
    required this.route,
    required this.label,
    required this.icon,
    required this.roles,
    this.mechanicLabel,
  });

  final String route;
  final String label;
  final IconData icon;
  final Set<UserRole> roles;

  /// Etiqueta alterna para el mecánico (por ejemplo, "Mis órdenes").
  final String? mechanicLabel;

  String labelFor(UserRole role) =>
      (role == UserRole.mechanic ? mechanicLabel : null) ?? label;
}

/// Módulos disponibles en el Sprint 1.
const List<NavItem> appNavItems = <NavItem>[
  NavItem(
    route: AppRoutes.dashboard,
    label: 'Panel',
    icon: LucideIcons.layoutDashboard,
    roles: <UserRole>{UserRole.admin},
  ),
  NavItem(
    route: AppRoutes.clients,
    label: 'Clientes',
    icon: LucideIcons.users,
    roles: <UserRole>{UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  NavItem(
    route: AppRoutes.vehicles,
    label: 'Vehículos',
    icon: LucideIcons.car,
    roles: <UserRole>{UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  NavItem(
    route: AppRoutes.appointments,
    label: 'Citas',
    icon: LucideIcons.calendarDays,
    roles: <UserRole>{UserRole.admin, UserRole.receptionist},
  ),
  NavItem(
    route: AppRoutes.orders,
    label: 'Órdenes',
    mechanicLabel: 'Mis órdenes',
    icon: LucideIcons.clipboardList,
    roles: <UserRole>{UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  NavItem(
    route: AppRoutes.payments,
    label: 'Pagos',
    icon: LucideIcons.banknote,
    roles: <UserRole>{UserRole.admin, UserRole.receptionist},
  ),
  NavItem(
    route: AppRoutes.maintenance,
    label: 'Mantenimientos',
    icon: LucideIcons.calendarClock,
    roles: <UserRole>{UserRole.admin, UserRole.receptionist},
  ),
  NavItem(
    route: AppRoutes.inventory,
    label: 'Inventario',
    icon: LucideIcons.package,
    roles: <UserRole>{UserRole.admin},
  ),
  NavItem(
    route: AppRoutes.users,
    label: 'Usuarios',
    icon: LucideIcons.userCog,
    roles: <UserRole>{UserRole.admin},
  ),
];

List<NavItem> navItemsFor(UserRole role) =>
    appNavItems.where((NavItem i) => i.roles.contains(role)).toList();

/// Armazón de las pantallas autenticadas: sidebar colapsable, encabezado y contenido.
class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.currentRoute,
    required this.title,
    required this.child,
  });

  /// Ruta del módulo activo en el sidebar.
  final String currentRoute;

  /// Nombre de la sección que se muestra en el encabezado.
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final AuthProvider auth = context.watch<AuthProvider>();
    final SidebarProvider sidebar = context.watch<SidebarProvider>();
    final AppUser? user = auth.user;
    if (user == null) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        // El estado se calcula con el ancho actual desde el primer fotograma (sin parpadeos).
        final double ancho = constraints.maxWidth;
        return Scaffold(
          body: Row(
            children: <Widget>[
              _Sidebar(
                user: user,
                expanded: sidebar.isExpanded(ancho),
                windowWidth: ancho,
                currentRoute: currentRoute,
              ),
              Expanded(
                child: Column(
                  children: <Widget>[
                    _Header(title: title, user: user),
                    Expanded(child: child),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

Future<void> _confirmLogout(BuildContext context) async {
  final AuthProvider auth = context.read<AuthProvider>();
  final bool confirmado = await showConfirmDialog(
    context,
    title: 'Cerrar sesión',
    message: confirmationText('cerrar sesión', irreversible: false),
  );
  if (confirmado) auth.logout();
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({
    required this.user,
    required this.expanded,
    required this.windowWidth,
    required this.currentRoute,
  });

  final AppUser user;
  final bool expanded;
  final double windowWidth;
  final String currentRoute;

  @override
  Widget build(BuildContext context) {
    final List<NavItem> items = navItemsFor(user.role);
    final int? selected = items.indexWhere((NavItem i) => i.route == currentRoute) >= 0
        ? items.indexWhere((NavItem i) => i.route == currentRoute)
        : null;

    Widget iconWithTooltip(NavItem item) => Tooltip(
          message: item.labelFor(user.role),
          child: item.route == AppRoutes.inventory
              ? _InventoryNavIcon(icon: item.icon)
              : Icon(item.icon, size: 20),
        );

    return NavigationRail(
      extended: expanded,
      minExtendedWidth: AppLayout.sidebarExpanded,
      minWidth: AppLayout.sidebarCollapsed,
      backgroundColor: AppColors.sidebar,
      selectedIndex: selected,
      useIndicator: true,
      labelType: NavigationRailLabelType.none,
      leading: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            IconButton(
              tooltip: expanded ? 'Contraer menú' : 'Expandir menú',
              color: AppColors.onSidebar,
              icon: Icon(expanded ? LucideIcons.panelLeftClose : LucideIcons.panelLeftOpen, size: 20),
              onPressed: () => context.read<SidebarProvider>().toggle(windowWidth),
            ),
            if (expanded) ...<Widget>[
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Motorix',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.onSidebar),
              ),
            ],
          ],
        ),
      ),
      destinations: <NavigationRailDestination>[
        for (final NavItem item in items)
          NavigationRailDestination(
            icon: iconWithTooltip(item),
            // El ancho del menú expandido es fijo (design-system): una etiqueta larga se recorta.
            label: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: AppLayout.sidebarExpanded - AppLayout.sidebarCollapsed - AppSpacing.lg,
              ),
              child: Text(
                item.labelFor(user.role),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          ),
      ],
      onDestinationSelected: (int index) {
        final String destino = items[index].route;
        if (destino != currentRoute) {
          Navigator.of(context).pushReplacementNamed(destino);
        }
      },
      trailing: Expanded(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: expanded
                ? SizedBox(
                    width: AppLayout.sidebarExpanded - AppSpacing.xxl,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          user.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .bodyLarge
                              ?.copyWith(color: AppColors.onSidebar),
                        ),
                        Text(
                          user.role.label,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppColors.onSidebarMuted),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        TextButton.icon(
                          style: TextButton.styleFrom(foregroundColor: AppColors.onSidebar),
                          onPressed: () => _confirmLogout(context),
                          icon: const Icon(LucideIcons.logOut, size: 18),
                          label: const Text('Cerrar sesión'),
                        ),
                      ],
                    ),
                  )
                : IconButton(
                    tooltip: 'Cerrar sesión',
                    color: AppColors.onSidebar,
                    icon: const Icon(LucideIcons.logOut, size: 20),
                    onPressed: () => _confirmLogout(context),
                  ),
          ),
        ),
      ),
    );
  }
}

enum _MenuAction { changePassword, logout }

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.user});

  final String title;
  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.outline)),
      ),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(title, style: text.titleMedium)),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(user.name, style: text.bodyLarge),
              Text(user.role.label, style: text.bodySmall),
            ],
          ),
          const SizedBox(width: AppSpacing.sm),
          PopupMenuButton<_MenuAction>(
            tooltip: 'Opciones de la cuenta',
            icon: const Icon(LucideIcons.circleUser, size: 24),
            onSelected: (_MenuAction accion) {
              switch (accion) {
                case _MenuAction.changePassword:
                  showChangePasswordDialog(context);
                case _MenuAction.logout:
                  _confirmLogout(context);
              }
            },
            itemBuilder: (BuildContext context) => const <PopupMenuEntry<_MenuAction>>[
              PopupMenuItem<_MenuAction>(
                value: _MenuAction.changePassword,
                child: Text('Cambiar contraseña'),
              ),
              PopupMenuItem<_MenuAction>(
                value: _MenuAction.logout,
                child: Text('Cerrar sesión'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Ícono de "Inventario" con la insignia del número de refacciones en stock bajo o agotadas.
/// Se consulta el conteo cada vez que se abre una pantalla (el menú se crea con cada una).
class _InventoryNavIcon extends StatefulWidget {
  const _InventoryNavIcon({required this.icon});

  final IconData icon;

  @override
  State<_InventoryNavIcon> createState() => _InventoryNavIconState();
}

class _InventoryNavIconState extends State<_InventoryNavIcon> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<InventoryProvider>().refreshAlerts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final AlertsSummary? alertas = context.watch<InventoryProvider>().alerts;
    final int total = alertas?.total ?? 0;
    return Badge(
      isLabelVisible: total > 0,
      label: Text('$total'),
      backgroundColor: (alertas?.out ?? 0) > 0 ? AppColors.danger : AppColors.warning,
      textColor: AppColors.onPrimary,
      child: Icon(widget.icon, size: 20),
    );
  }
}
