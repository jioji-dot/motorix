import 'package:flutter/material.dart';

import '../models/part.dart';
import '../utils/app_theme.dart';
import 'status_chip.dart';

/// Chip del estado de existencia de una refacción: Normal, Stock bajo, Agotada o Inactiva.
class StockChip extends StatelessWidget {
  const StockChip({super.key, required this.part});

  final Part part;

  @override
  Widget build(BuildContext context) {
    if (!part.active) {
      return const StatusChip(label: 'Inactiva', color: AppColors.textSecondary);
    }
    return StatusChip(label: part.stockStatus.label, color: part.stockStatus.color);
  }
}
