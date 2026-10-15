import 'package:flutter/foundation.dart';

import '../utils/app_theme.dart';

/// Estado del sidebar (expandido o colapsado). Se conserva al navegar entre pantallas.
///
/// Mientras el usuario no lo alterne, el estado depende del ancho de la ventana: arranca
/// colapsado cuando es menor a 1000 px. Al alternarlo, se respeta su decisión.
class SidebarProvider extends ChangeNotifier {
  bool _expanded = true;
  bool _userChoice = false;

  /// Indica si el sidebar debe mostrarse expandido para una ventana del [ancho] indicado.
  bool isExpanded(double ancho) =>
      _userChoice ? _expanded : ancho >= AppLayout.collapseBreakpoint;

  /// Alterna el sidebar por decisión del usuario, a partir de lo que se ve en [ancho].
  void toggle(double ancho) {
    _expanded = !isExpanded(ancho);
    _userChoice = true;
    notifyListeners();
  }
}
