import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/clients_provider.dart';
import 'providers/sidebar_provider.dart';
import 'screens/clients_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
import 'utils/app_theme.dart';

void main() {
  runApp(MotorixApp(api: ApiClient()));
}

/// Aplicación Motorix: tema propio, estado con Provider y rutas protegidas por sesión.
class MotorixApp extends StatelessWidget {
  const MotorixApp({super.key, required this.api, this.useGoogleFonts = true});

  final ApiClient api;
  final bool useGoogleFonts;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthProvider(api)),
        ChangeNotifierProvider(create: (_) => SidebarProvider()),
        // Providers de datos: viven sobre el Navigator para que los vean las pantallas que se abren
        // con push, y se vacían al terminar la sesión.
        ChangeNotifierProvider(
          create: (c) {
            final provider = ClientsProvider(api);
            c.read<AuthProvider>().addSessionEndListener(provider.reset);
            return provider;
          },
        ),
      ],
      child: MaterialApp(
        title: 'Motorix',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(useGoogleFonts: useGoogleFonts),
        home: const _AuthGate(),
      ),
    );
  }
}

/// Muestra el inicio de sesión o la pantalla principal según la sesión.
class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final autenticado = context.select<AuthProvider, bool>((a) => a.isAuthenticated);
    return AnimatedSwitcher(
      duration: AppMotion.navigation,
      child: autenticado
          ? HomeScreen(
              key: const ValueKey('home'),
              sectionBuilders: {
                'Clientes': (_) => const ClientsScreen(),
              },
            )
          : const LoginScreen(key: ValueKey('login')),
    );
  }
}
