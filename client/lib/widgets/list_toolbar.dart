import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Barra superior de los listados: búsqueda a la izquierda y acciones a la derecha.
/// En anchos reducidos, las acciones pasan debajo de la búsqueda para no desbordar.
class ListToolbar extends StatelessWidget {
  const ListToolbar({super.key, required this.search, this.actions = const []});

  final Widget search;
  final List<Widget> actions;

  static const double _anchoMinimoEnFila = 720;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, restricciones) {
        if (restricciones.maxWidth >= _anchoMinimoEnFila) {
          return Row(
            children: [
              Expanded(child: search),
              for (final accion in actions) ...[
                const SizedBox(width: AppSpacing.md),
                accion,
              ],
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            search,
            if (actions.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: actions,
              ),
            ],
          ],
        );
      },
    );
  }
}
