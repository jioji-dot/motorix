import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Indicador de carga pequeño para el interior de un botón principal.
class ButtonSpinner extends StatelessWidget {
  const ButtonSpinner({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary),
    );
  }
}
