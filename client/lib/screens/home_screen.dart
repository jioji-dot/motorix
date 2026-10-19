import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../utils/app_theme.dart';
import '../widgets/app_shell.dart';
import '../widgets/confirm_dialog.dart';
import 'change_password_screen.dart';
import '../widgets/state_views.dart';

/// Secciones del Sprint 1. Solo se muestran las que corresponden al rol (FR-029).
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
    label: 'Usuarios',
    icon: LucideIcons.userCog,
    roles: {UserRole.admin},
  ),
];

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

    return AppShell(
      user: user,
      sections: secciones,
      selectedIndex: _index,
      onSelect: (i) => setState(() => _index = i),
      onChangePassword: widget.onChangePassword ??
          () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const ChangePasswordScreen()),
              ),
      onLogout: widget.onLogout ?? () => _confirmarCierre(context, auth),
      child: AnimatedSwitcher(
        duration: AppMotion.navigation,
        switchInCurve: AppMotion.curve,
        child: KeyedSubtree(
          key: ValueKey(actual.label),
          child: constructor != null
              ? constructor(context)
              : const EmptyState(title: 'Sección en construcción'),
        ),
      ),
    );
  }
}
