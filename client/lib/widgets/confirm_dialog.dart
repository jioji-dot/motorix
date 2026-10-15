import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Diálogo de confirmación obligatorio para acciones destructivas o de salida
/// (`docs/design-system.md`, sección 8.5). Devuelve `true` si el usuario confirma.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String message,
  String title = 'Confirmar',
  String confirmLabel = 'Confirmar',
  String cancelLabel = 'Cancelar',
}) async {
  final bool? resultado = await showDialog<bool>(
    context: context,
    builder: (BuildContext contexto) => AlertDialog(
      title: Text(title),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Text(message),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        0,
        AppSpacing.xl,
        AppSpacing.lg,
      ),
      actions: <Widget>[
        OutlinedButton(
          onPressed: () => Navigator.of(contexto).pop(false),
          child: Text(cancelLabel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(contexto).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return resultado ?? false;
}

/// Texto estándar: "¿Seguro que quieres [acción]? Esta acción no se puede deshacer."
String confirmationText(String accion, {bool irreversible = true}) {
  final String base = '¿Seguro que quieres $accion?';
  return irreversible ? '$base Esta acción no se puede deshacer.' : base;
}
