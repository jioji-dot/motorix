import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/report.dart';
import '../providers/reports_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';

/// Reportes del administrador: ingresos, servicios frecuentes, productividad, refacciones y rotación, con exportación a CSV (Sprint 7).
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  late final TextEditingController _desde;
  late final TextEditingController _hasta;

  @override
  void initState() {
    super.initState();
    final p = context.read<ReportsProvider>();
    _desde = TextEditingController(text: p.from);
    _hasta = TextEditingController(text: p.to);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ReportsProvider>().load();
    });
  }

  @override
  void dispose() {
    _desde.dispose();
    _hasta.dispose();
    super.dispose();
  }

  void _sincronizar(ReportsProvider p) {
    _desde.text = p.from;
    _hasta.text = p.to;
  }

  Future<void> _exportar() async {
    final mensaje = await context.read<ReportsProvider>().export();
    if (mounted && mensaje != null) showFeedback(context, mensaje, error: true);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ReportsProvider>();
    final texto = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final r in ReportKind.values)
                ChoiceChip(
                  key: Key('reporte-${r.path}'),
                  label: Text(r.label),
                  selected: p.kind == r,
                  onSelected: (_) => p.selectKind(r),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(width: 160, child: TextField(key: const Key('campo-desde'), controller: _desde, decoration: const InputDecoration(labelText: 'Desde (AAAA-MM-DD)'))),
              SizedBox(width: 160, child: TextField(key: const Key('campo-hasta'), controller: _hasta, decoration: const InputDecoration(labelText: 'Hasta (AAAA-MM-DD)'))),
              FilledButton(key: const Key('consultar-reporte'), onPressed: () => p.setRange(_desde.text.trim(), _hasta.text.trim()), child: const Text('Consultar')),
              TextButton(key: const Key('atajo-mes'), onPressed: () { p.setShortcut('mes'); _sincronizar(p); }, child: const Text('Este mes')),
              TextButton(key: const Key('atajo-mes-pasado'), onPressed: () { p.setShortcut('mes-pasado'); _sincronizar(p); }, child: const Text('Mes pasado')),
              TextButton(key: const Key('atajo-anio'), onPressed: () { p.setShortcut('anio'); _sincronizar(p); }, child: const Text('Últimos 12 meses')),
              if (p.kind == ReportKind.income)
                SegmentedButton<String>(
                  key: const Key('agrupar'),
                  segments: const [ButtonSegment(value: 'day', label: Text('Por día')), ButtonSegment(value: 'month', label: Text('Por mes'))],
                  selected: {p.groupBy},
                  onSelectionChanged: (s) => p.setGroupBy(s.first),
                ),
              OutlinedButton.icon(
                key: const Key('exportar-reporte'),
                onPressed: p.data == null ? null : _exportar,
                icon: const Icon(LucideIcons.download, size: 18),
                label: const Text('Exportar CSV'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(child: _cuerpo(p, texto)),
        ],
      ),
    );
  }

  Widget _cuerpo(ReportsProvider p, TextTheme texto) {
    if (p.loading && p.data == null) return const LoadingState(message: 'Calculando el reporte...');
    if (p.error != null) return ErrorState(message: p.error!, onRetry: p.load);
    final d = p.data;
    if (d == null) return const SizedBox.shrink();
    return SingleChildScrollView(child: _contenido(p.kind, d, texto));
  }

  Widget _total(String etiqueta, String valor, TextTheme texto) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
        child: Row(children: [Text('$etiqueta: ', style: texto.titleSmall), Text(valor, key: Key('total-${etiqueta.toLowerCase()}'), style: texto.titleLarge)]),
      );

  DataTable _tabla(List<String> columnas, List<List<Widget>> filas, {Set<int> numericas = const {}}) => DataTable(
        columns: [for (var i = 0; i < columnas.length; i++) DataColumn(label: Text(columnas[i]), numeric: numericas.contains(i))],
        rows: [for (final f in filas) DataRow(cells: [for (final c in f) DataCell(c)])],
      );

  Widget _contenido(ReportKind tipo, Map<String, dynamic> d, TextTheme texto) {
    List<Map<String, dynamic>> lista(String clave) => (d[clave] as List<dynamic>).cast<Map<String, dynamic>>();
    final vacio = const EmptyState(icon: LucideIcons.chartBar, title: 'No hay información en este periodo');
    switch (tipo) {
      case ReportKind.income:
        if (lista('byPeriod').isEmpty) return Column(children: [_total('Total', formatMoney(d['total'] as String), texto), vacio]);
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _total('Total', formatMoney(d['total'] as String), texto),
          Text('Por método de pago', style: texto.titleSmall),
          _tabla(['Método', 'Importe'], [for (final m in lista('byMethod')) [Text(paymentMethodName(m['method'] as String)), Text(formatMoney(m['total'] as String))]], numericas: {1}),
          const SizedBox(height: AppSpacing.lg),
          Text('Por periodo', style: texto.titleSmall),
          _tabla(['Periodo', 'Importe'], [for (final m in lista('byPeriod')) [Text(periodLabel(m['period'] as String)), Text(formatMoney(m['total'] as String))]], numericas: {1}),
        ]);
      case ReportKind.services:
        if (lista('items').isEmpty) return vacio;
        return _tabla(['Servicio', 'Cantidad', 'Importe'], [
          for (final i in lista('items')) [Text(i['name'] as String), Text('${i['count']}'), Text(formatMoney(i['amount'] as String))],
        ], numericas: {1, 2});
      case ReportKind.productivity:
        if (lista('items').isEmpty) return vacio;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _total('Órdenes', '${d['totalOrders']}', texto),
          _tabla(['Mecánico', 'Órdenes', 'Mano de obra'], [
            for (final i in lista('items')) [Text((i['mechanic'] as Map<String, dynamic>)['name'] as String), Text('${i['orders']}'), Text(formatMoney(i['laborAmount'] as String))],
          ], numericas: {1, 2}),
          const SizedBox(height: AppSpacing.md),
          Text('Mano de obra total: ${formatMoney(d['totalLabor'] as String)}', style: texto.titleSmall),
        ]);
      case ReportKind.parts:
        if (lista('items').isEmpty) return vacio;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _tabla(['Refacción', 'Unidades', 'Costo', 'Venta', 'Margen'], [
            for (final i in lista('items'))
              [
                Text('${(i['part'] as Map<String, dynamic>)['code']} · ${(i['part'] as Map<String, dynamic>)['name']}'),
                Text('${i['units']}'),
                i['noCost'] == true ? const StatusChip(label: 'Sin costo', color: AppColors.textSecondary) : Text(formatMoney(i['cost'] as String)),
                Text(formatMoney(i['sale'] as String)),
                Text(i['noCost'] == true ? '—' : formatMoney(i['margin'] as String)),
              ],
          ], numericas: {1, 2, 3, 4}),
          const SizedBox(height: AppSpacing.md),
          Text('Venta ${formatMoney(d['totalSale'] as String)} · Costo ${formatMoney(d['totalCost'] as String)} · Margen ${formatMoney(d['totalMargin'] as String)}', style: texto.titleSmall),
        ]);
      case ReportKind.rotation:
        if (lista('items').isEmpty) return vacio;
        return _tabla(['Refacción', 'Salidas', 'Existencia', 'Rotación'], [
          for (final i in lista('items'))
            [
              Text('${(i['part'] as Map<String, dynamic>)['code']} · ${(i['part'] as Map<String, dynamic>)['name']}'),
              Text('${i['unitsOut']}'),
              Text('${i['stock']}'),
              Text(i['rotation'] == null ? 'Sin existencia' : '${i['rotation']}'),
            ],
        ], numericas: {1, 2, 3});
    }
  }
}
