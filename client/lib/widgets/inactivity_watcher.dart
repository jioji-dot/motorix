import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// Cierra la sesión tras [timeout] sin actividad de la persona: tocar, escribir o desplazarse reinicia el
/// temporizador (Sprint 7, FR-028). La consulta automática de avisos no cuenta como actividad.
class InactivityWatcher extends StatefulWidget {
  const InactivityWatcher({
    super.key,
    required this.child,
    required this.onTimeout,
    this.timeout = const Duration(minutes: 30),
  });

  final Widget child;
  final VoidCallback onTimeout;
  final Duration timeout;

  @override
  State<InactivityWatcher> createState() => _InactivityWatcherState();
}

class _InactivityWatcherState extends State<InactivityWatcher> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _reiniciar();
    HardwareKeyboard.instance.addHandler(_teclado);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_teclado);
    _timer?.cancel();
    super.dispose();
  }

  bool _teclado(KeyEvent _) {
    _reiniciar();
    return false; // no consume la tecla
  }

  void _reiniciar() {
    _timer?.cancel();
    _timer = Timer(widget.timeout, () {
      if (mounted) widget.onTimeout();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _reiniciar(),
      onPointerMove: (_) => _reiniciar(),
      onPointerSignal: (_) => _reiniciar(),
      child: widget.child,
    );
  }
}
