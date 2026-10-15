import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/appointments_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/clients_provider.dart';
import 'providers/inventory_provider.dart';
import 'providers/maintenance_provider.dart';
import 'providers/orders_provider.dart';
import 'providers/payments_provider.dart';
import 'providers/tickets_provider.dart';
import 'providers/sidebar_provider.dart';
import 'providers/users_provider.dart';
import 'providers/vehicles_provider.dart';
import 'router.dart';
import 'services/api_client.dart';
import 'services/appointments_service.dart';
import 'services/clients_service.dart';
import 'services/inventory_service.dart';
import 'services/maintenance_service.dart';
import 'services/orders_service.dart';
import 'services/dashboard_service.dart';
import 'services/payments_service.dart';
import 'services/tickets_service.dart';
import 'services/users_service.dart';
import 'services/vehicles_service.dart';
import 'utils/app_theme.dart';

void main() {
  runApp(const MotorixApp());
}

/// Aplicación Motorix. Los parámetros permiten inyectar dependencias en las pruebas.
class MotorixApp extends StatelessWidget {
  const MotorixApp({super.key, this.apiClient, this.useGoogleFonts = true});

  final ApiClient? apiClient;
  final bool useGoogleFonts;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>(create: (_) => apiClient ?? ApiClient()),
        ChangeNotifierProvider<AuthProvider>(
          create: (BuildContext c) => AuthProvider(api: c.read<ApiClient>()),
        ),
        ChangeNotifierProvider<SidebarProvider>(create: (_) => SidebarProvider()),
        Provider<ClientsService>(
          create: (BuildContext c) => ClientsService(c.read<ApiClient>()),
        ),
        ChangeNotifierProvider<ClientsProvider>(
          create: (BuildContext c) => ClientsProvider(c.read<ClientsService>()),
        ),
        ChangeNotifierProvider<VehiclesProvider>(
          create: (BuildContext c) => VehiclesProvider(VehiclesService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<AppointmentsProvider>(
          create: (BuildContext c) => AppointmentsProvider(AppointmentsService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<OrdersProvider>(
          create: (BuildContext c) => OrdersProvider(OrdersService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<InventoryProvider>(
          create: (BuildContext c) => InventoryProvider(InventoryService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<MaintenanceProvider>(
          create: (BuildContext c) => MaintenanceProvider(MaintenanceService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<PaymentsProvider>(
          create: (BuildContext c) => PaymentsProvider(PaymentsService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<DashboardProvider>(
          create: (BuildContext c) => DashboardProvider(DashboardService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<TicketsProvider>(
          create: (BuildContext c) => TicketsProvider(TicketsService(c.read<ApiClient>())),
        ),
        ChangeNotifierProvider<UsersProvider>(
          create: (BuildContext c) => UsersProvider(UsersService(c.read<ApiClient>())),
        ),
      ],
      child: MaterialApp(
        title: 'Motorix',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(useGoogleFonts: useGoogleFonts),
        home: const AuthGate(),
      ),
    );
  }
}
