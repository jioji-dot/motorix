import 'package:flutter/material.dart';

import '../utils/app_theme.dart';

/// Tabla densa que ocupa todo el ancho disponible y desplaza su contenido si no cabe.
/// Usa el `DataTable` nativo con el tema de la aplicación (`DataTableThemeData`).
class AppDataTable extends StatefulWidget {
  const AppDataTable({super.key, required this.columns, required this.rows});

  final List<DataColumn> columns;
  final List<DataRow> rows;

  @override
  State<AppDataTable> createState() => _AppDataTableState();
}

class _AppDataTableState extends State<AppDataTable> {
  final ScrollController _vertical = ScrollController();
  final ScrollController _horizontal = ScrollController();

  @override
  void dispose() {
    _vertical.dispose();
    _horizontal.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        return Scrollbar(
          controller: _vertical,
          thumbVisibility: true,
          child: SingleChildScrollView(
            controller: _vertical,
            child: SingleChildScrollView(
              controller: _horizontal,
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: constraints.maxWidth),
                child: DataTable(
                  showCheckboxColumn: false,
                  columnSpacing: AppSpacing.xl,
                  horizontalMargin: AppSpacing.lg,
                  headingRowHeight: 44,
                  dataRowMinHeight: 48,
                  dataRowMaxHeight: 56,
                  columns: widget.columns,
                  rows: widget.rows,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
