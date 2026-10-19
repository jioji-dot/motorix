import 'package:flutter/foundation.dart';

/// Estado de la barra lateral (expandida o colapsada). Se conserva al navegar.
class SidebarProvider extends ChangeNotifier {
  bool _expanded = true;
  bool _initialized = false;

  bool get expanded => _expanded;

  /// Si la ventana mide menos de ~1000 px, la barra arranca colapsada (solo la primera vez).
  void initForWidth(double width) {
    if (_initialized) return;
    _initialized = true;
    _expanded = width >= 1000;
  }

  void toggle() {
    _expanded = !_expanded;
    notifyListeners();
  }
}
