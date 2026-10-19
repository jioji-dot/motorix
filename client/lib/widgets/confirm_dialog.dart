import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Diálogo de confirmación obligatorio para acciones destructivas o de salida.
/// Devuelve `true` solo si la persona elige "Confirmar".
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirmar',
  String cancelLabel = 'Cancelar',
  bool destructive = false,
}) async {
  final resultado = await showDialog<bool>(
    context: context,
    builder: (contexto) => AlertDialog(
      title: Text(title),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Text(message),
      ),
      actions: [
        OutlinedButton(
          onPressed: () => Navigator.of(contexto).pop(false),
          child: Text(cancelLabel),
        ),
        FilledButton(
          style: destructive ? FilledButton.styleFrom(backgroundColor: AppColors.danger) : null,
          onPressed: () => Navigator.of(contexto).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return resultado ?? false;
}

/// Pregunta si se descartan los cambios sin guardar al salir de un formulario.
Future<bool> confirmDiscardChanges(BuildContext context) => showConfirmDialog(
      context,
      title: 'Salir sin guardar',
      message: 'Tienes cambios sin guardar. Si sales ahora se perderán.',
      confirmLabel: 'Confirmar',
    );
