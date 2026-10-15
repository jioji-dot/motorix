import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/paged_result.dart';
import '../utils/app_theme.dart';

/// Pie de tabla con el rango mostrado y botones para cambiar de página.
class PaginationBar extends StatelessWidget {
  const PaginationBar({super.key, required this.result, required this.onPage});

  final PagedResult<dynamic> result;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.outline)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: <Widget>[
          Text(
            result.total == 0
                ? '0 resultados'
                : '${result.firstItem}–${result.lastItem} de ${result.total}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(width: AppSpacing.md),
          IconButton(
            tooltip: 'Página anterior',
            icon: const Icon(LucideIcons.chevronLeft, size: 18),
            onPressed: result.hasPrevious ? () => onPage(result.page - 1) : null,
          ),
          IconButton(
            tooltip: 'Página siguiente',
            icon: const Icon(LucideIcons.chevronRight, size: 18),
            onPressed: result.hasNext ? () => onPage(result.page + 1) : null,
          ),
        ],
      ),
    );
  }
}
