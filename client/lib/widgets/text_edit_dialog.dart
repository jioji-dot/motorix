import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Cuadro para editar un texto largo (diagnóstico, observaciones, recomendaciones).
/// Devuelve el texto recortado (vacío si se borró) o null si se canceló.
Future<String?> showTextEditDialog(
  BuildContext context, {
  required String title,
  String? initial,
  String label = 'Texto',
  int maxLength = 5000,
}) {
  return showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => _TextEditDialog(
      title: title,
      initial: initial ?? '',
      label: label,
      maxLength: maxLength,
    ),
  );
}

class _TextEditDialog extends StatefulWidget {
  const _TextEditDialog({
    required this.title,
    required this.initial,
    required this.label,
    required this.maxLength,
  });

  final String title;
  final String initial;
  final String label;
  final int maxLength;

  @override
  State<_TextEditDialog> createState() => _TextEditDialogState();
}

class _TextEditDialogState extends State<_TextEditDialog> {
  late final TextEditingController _controller;
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initial);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 520,
        child: Form(
          key: _formKey,
          child: TextFormField(
            controller: _controller,
            autofocus: true,
            minLines: 5,
            maxLines: 10,
            decoration: InputDecoration(labelText: widget.label),
            validator: (String? v) => (v ?? '').trim().length > widget.maxLength
                ? 'Máximo ${widget.maxLength} caracteres.'
                : null,
          ),
        ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        0,
        AppSpacing.xl,
        AppSpacing.lg,
      ),
      actions: <Widget>[
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () {
            if (_formKey.currentState?.validate() ?? false) {
              Navigator.of(context).pop(_controller.text.trim());
            }
          },
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}
