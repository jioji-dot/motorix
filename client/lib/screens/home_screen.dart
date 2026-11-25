import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/notification.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/maintenance_provider.dart';
import '../providers/notifications_provider.dart';
import '../utils/app_theme.dart';
import '../widgets/app_shell.dart';
import '../widgets/confirm_dialog.dart';
import 'appointment_detail_screen.dart';
import 'change_password_screen.dart';
import 'order_detail_screen.dart';
import 'part_detail_screen.dart';
import '../widgets/state_views.dart';

/// Secciones de la aplicación. Solo se muestran las que corresponden al rol (FR-029 del Sprint 1 y FR-028 del Sprint 2).
const _todasLasSecciones = [
  ShellSection(
    label: 'Clientes',
    icon: LucideIcons.users,
    roles: {UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  ShellSection(
    label: 'Vehículos',
    icon: LucideIcons.car,
    roles: {UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  ShellSection(
    label: 'Citas',
    icon: LucideIcons.calendarDays,
    roles: {UserRole.admin, UserRole.receptionist},
  ),
  ShellSection(
    label: 'Órdenes de servicio',
    icon: LucideIcons.clipboardList,
    roles: {UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  ShellSection(
    label: 'Mantenimientos',
    icon: LucideIcons.wrench,
    roles: {UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  ShellSection(
    label: 'Inventario',
    icon: LucideIcons.package,
    roles: {UserRole.admin, UserRole.receptionist, UserRole.mechanic},
  ),
  ShellSection(
    label: 'Clientes por avisar',
    icon: LucideIcons.phoneCall,
    roles: {UserRole.admin, UserRole.receptionist},
  ),
  ShellSection(
    label: 'Panel de control',
    icon: LucideIcons.layoutDashboard,
    roles: {UserRole.admin},
  ),
  ShellSection(
    label: 'Reportes',
    icon: LucideIcons.chartBar,
    roles: {UserRole.admin},
  ),
  ShellSection(
    label: 'Usuarios',
    icon: LucideIcons.userCog,
    roles: {UserRole.admin},
  ),
  ShellSection(
    label: 'Configuración',
    icon: LucideIcons.settings,
    roles: {UserRole.admin},
  ),
];

/// Permite que una pantalla de una sección lleve a otra (por ejemplo, las tarjetas del panel de control).
class HomeNavigation extends InheritedWidget {
  const HomeNavigation({super.key, required this.goTo, required super.child});

  /// Cambia a la sección con esa etiqueta, si el rol del usuario la puede ver.
  final void Function(String etiqueta) goTo;

  static HomeNavigation? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<HomeNavigation>();

  @override
  bool updateShouldNotify(HomeNavigation old) => false;
}

/// Pantalla principal tras iniciar sesión. La pantalla inicial es Clientes.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    this.sectionBuilders = const {},
    this.onChangePassword,
    this.onLogout,
  });

  /// Contenido de cada sección, por etiqueta.
  final Map<String, WidgetBuilder> sectionBuilders;

  /// Acciones del menú de usuario (si no se indican, usa las predeterminadas).
  final VoidCallback? onChangePassword;
  final VoidCallback? onLogout;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  /// Cambia con cada apertura de Mantenimientos desde un aviso para que la pantalla lea la búsqueda recibida.
  int _aperturas = 0;

  late final NotificationsProvider _avisos;

  @override
  void initState() {
    super.initState();
    _avisos = context.read<NotificationsProvider>();
    // Los avisos se piden al iniciar sesión y se repiten cada 60 segundos mientras la pantalla esté abierta.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _avisos.start();
    });
  }

  @override
  void dispose() {
    // El provider vive sobre el Navigator: se detiene aquí por si la pantalla se cierra sin terminar la sesión.
    _avisos.stop();
    super.dispose();
  }

  /// Lleva a la pantalla relacionada con el aviso: detalle de la orden, de la cita o de la refacción, o Mantenimientos
  /// con la placa en el buscador (FR-010).
  void _abrirAviso(NoticeTarget destino, List<ShellSection> secciones) {
    switch (destino.kind) {
      case 'order':
        Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: destino.id)));
      case 'appointment':
        Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => AppointmentDetailScreen(appointmentId: destino.id)));
      case 'part':
        Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => PartDetailScreen(partId: destino.id)));
      case 'maintenance':
        final indice = secciones.indexWhere((s) => s.label == 'Mantenimientos');
        if (indice < 0) return;
        context.read<MaintenanceProvider>().search = destino.search ?? '';
        setState(() {
          _index = indice;
          _aperturas += 1;
        });
    }
  }

  /// Cerrar sesión siempre pide confirmación.
  Future<void> _confirmarCierre(BuildContext context, AuthProvider auth) async {
    final confirmado = await showConfirmDialog(
      context,
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres cerrar tu sesión?',
    );
    if (confirmado) auth.logout();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    // Durante la transición de salida la sesión ya terminó: no hay nada que dibujar.
    if (user == null) return const SizedBox.shrink();
    final secciones = _todasLasSecciones.where((s) => s.roles.contains(user.role)).toList();
    if (_index >= secciones.length) _index = 0;
    final actual = secciones[_index];

    final constructor = widget.sectionBuilders[actual.label];
    final avisos = context.watch<NotificationsProvider>();

    return AppShell(
      user: user,
      sections: secciones,
      selectedIndex: _index,
      onSelect: (i) {
        setState(() => _index = i);
        context.read<NotificationsProvider>().refresh(silent: true);
      },
      badges: {
        if (user.role == UserRole.admin) 'Inventario': avisos.stockAlerts,
        'Clientes por avisar': avisos.clientsToNotify,
      },
      onOpenNotice: (destino) => _abrirAviso(destino, secciones),
      onChangePassword: widget.onChangePassword ??
          () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const ChangePasswordScreen()),
              ),
      onLogout: widget.onLogout ?? () => _confirmarCierre(context, auth),
      child: AnimatedSwitcher(
        duration: AppMotion.navigation,
        switchInCurve: AppMotion.curve,
        child: KeyedSubtree(
          key: ValueKey('${actual.label}-$_aperturas'),
          child: HomeNavigation(
            goTo: (etiqueta) {
              final destino = secciones.indexWhere((s) => s.label == etiqueta);
              if (destino >= 0) setState(() => _index = destino);
            },
            child: constructor != null
                ? constructor(context)
                : const EmptyState(title: 'Sección en construcción'),
          ),
        ),
      ),
    );
  }
}
