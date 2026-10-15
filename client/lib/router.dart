import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_routes.dart';
import 'models/appointment.dart';
import 'models/client.dart';
import 'models/part.dart';
import 'models/user.dart';
import 'providers/auth_provider.dart';
import 'screens/appointments/appointment_form_screen.dart';
import 'screens/appointments/appointments_list_screen.dart';
import 'screens/clients/client_detail_screen.dart';
import 'screens/clients/client_form_screen.dart';
import 'screens/clients/clients_list_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/inventory/inventory_list_screen.dart';
import 'screens/inventory/part_detail_screen.dart';
import 'screens/inventory/part_form_screen.dart';
import 'screens/login_screen.dart';
import 'screens/maintenance/maintenance_list_screen.dart';
import 'screens/orders/order_detail_screen.dart';
import 'screens/orders/order_form_screen.dart';
import 'screens/orders/orders_list_screen.dart';
import 'screens/payments/payments_list_screen.dart';
import 'screens/tickets/ticket_screen.dart';
import 'screens/users/user_form_screen.dart';
import 'screens/users/users_list_screen.dart';
import 'screens/vehicles/vehicle_detail_screen.dart';
import 'screens/vehicles/vehicle_form_screen.dart';
import 'screens/vehicles/vehicles_list_screen.dart';
import 'utils/app_theme.dart';

/// Genera las rutas de la parte autenticada de la aplicación.
Route<dynamic> generateAppRoute(RouteSettings settings) {
  final Widget pantalla = switch (settings.name) {
    AppRoutes.clients => const ClientsListScreen(),
    AppRoutes.clientDetail => ClientDetailScreen(clientId: settings.arguments as int),
    AppRoutes.clientForm => ClientFormScreen(client: settings.arguments as Client?),
    AppRoutes.appointments => const AppointmentsListScreen(),
    AppRoutes.appointmentForm =>
      AppointmentFormScreen(appointment: settings.arguments as Appointment?),
    AppRoutes.orders => const OrdersListScreen(),
    AppRoutes.orderDetail => OrderDetailScreen(orderId: settings.arguments as int),
    AppRoutes.orderForm => OrderFormScreen(args: settings.arguments as OrderFormArgs?),
    AppRoutes.dashboard => const DashboardScreen(),
    AppRoutes.payments => const PaymentsListScreen(),
    AppRoutes.ticket => TicketScreen(ticketId: settings.arguments as int),
    AppRoutes.vehicles => const VehiclesListScreen(),
    AppRoutes.vehicleDetail => VehicleDetailScreen(vehicleId: settings.arguments as int),
    AppRoutes.vehicleForm => VehicleFormScreen(args: settings.arguments as VehicleFormArgs?),
    AppRoutes.maintenance => const MaintenanceListScreen(),
    AppRoutes.inventory => InventoryListScreen(initialAlert: settings.arguments as AlertFilter?),
    AppRoutes.inventoryDetail => PartDetailScreen(partId: settings.arguments as int),
    AppRoutes.inventoryForm => PartFormScreen(part: settings.arguments as Part?),
    AppRoutes.users => const UsersListScreen(),
    AppRoutes.userForm => UserFormScreen(user: settings.arguments as AppUser?),
    _ => const ClientsListScreen(),
  };
  return _AppPageRoute(builder: (_) => pantalla, settings: settings);
}

/// Ruta con la duración de navegación del sistema de diseño (250 ms).
class _AppPageRoute extends MaterialPageRoute<Object?> {
  _AppPageRoute({required super.builder, super.settings});

  @override
  Duration get transitionDuration => AppMotion.navigation;

  @override
  Duration get reverseTransitionDuration => AppMotion.navigation;
}

/// Muestra el login cuando no hay sesión y la navegación autenticada cuando sí la hay.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final AuthProvider auth = context.watch<AuthProvider>();
    if (!auth.isAuthenticated) return const LoginScreen();
    return Navigator(
      // La clave por usuario reinicia la pila de navegación al cambiar de sesión.
      key: ValueKey<int>(auth.user!.id),
      // El administrador inicia en el panel, el mecánico en "Mis órdenes" y recepción en Clientes.
      initialRoute: switch (auth.user!.role) {
        UserRole.admin => AppRoutes.dashboard,
        UserRole.mechanic => AppRoutes.orders,
        UserRole.receptionist => AppRoutes.clients,
      },
      onGenerateRoute: generateAppRoute,
    );
  }
}
