import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/history_entry.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'panel.dart';
import 'status_chip.dart';

/// Tarjeta de un servicio del historial del vehículo: resumen siempre visible y el detalle de
/// servicios, mano de obra y refacciones desplegable. Es de solo lectura.
class HistoryCard extends StatefulWidget {
  const HistoryCard({super.key, required this.entry, required this.onOpenOrder});

  final HistoryEntry entry;

  /// Abre el detalle de la orden de origen.
  final VoidCallback onOpenOrder;

  @override
  State<HistoryCard> createState() => _HistoryCardState();
}

class _HistoryCardState extends State<HistoryCard> {
  bool _expanded = false;

  HistoryEntry get entry => widget.entry;
  VoidCallback get onOpenOrder => widget.onOpenOrder;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Panel(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              TextButton(
                onPressed: onOpenOrder,
                child: Text(entry.folio, style: text.titleMedium),
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusChip(label: entry.status.label, color: entry.status.color),
              const Spacer(),
              Text(Format.instant(entry.serviceDate), style: text.bodySmall),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xl,
            runSpacing: AppSpacing.xs,
            children: <Widget>[
              _Dato(icono: LucideIcons.gauge, texto: Format.mileage(entry.mileage)),
              _Dato(icono: LucideIcons.wrench, texto: entry.mechanicName ?? 'Sin mecánico asignado'),
              _Dato(icono: LucideIcons.receipt, texto: 'Total ${Format.money(entry.total)}'),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _Texto(etiqueta: 'Problema reportado', valor: entry.reportedProblem),
          if (_hay(entry.diagnosis)) _Texto(etiqueta: 'Diagnóstico', valor: entry.diagnosis!),
          if (_hay(entry.recommendations))
            _Texto(etiqueta: 'Recomendaciones', valor: entry.recommendations!),
          if (entry.services.isNotEmpty || entry.labor.isNotEmpty || entry.parts.isNotEmpty)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() => _expanded = !_expanded),
                icon: Icon(_expanded ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 16),
                label: Text(_expanded ? 'Ocultar detalle del servicio' : 'Ver detalle del servicio'),
              ),
            ),
          if (_expanded) ...<Widget>[
            _Lineas(titulo: 'Servicios realizados', lineas: entry.services),
            _Lineas(titulo: 'Mano de obra', lineas: entry.labor),
            _Lineas(titulo: 'Refacciones', lineas: entry.parts),
          ],
        ],
      ),
    );
  }

  bool _hay(String? texto) => texto != null && texto.trim().isNotEmpty;
}

class _Dato extends StatelessWidget {
  const _Dato({required this.icono, required this.texto});

  final IconData icono;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icono, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: AppSpacing.xs),
        Text(texto, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _Texto extends StatelessWidget {
  const _Texto({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 150, child: Text(etiqueta, style: text.bodySmall)),
          Expanded(child: Text(valor, style: text.bodyMedium)),
        ],
      ),
    );
  }
}

class _Lineas extends StatelessWidget {
  const _Lineas({required this.titulo, required this.lineas});

  final String titulo;
  final List<HistoryLine> lineas;

  @override
  Widget build(BuildContext context) {
    if (lineas.isEmpty) return const SizedBox.shrink();
    final TextTheme text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(titulo, style: text.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          for (final HistoryLine l in lineas)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: <Widget>[
                  Expanded(child: Text(l.description, style: text.bodyMedium)),
                  if (l.detail != null) ...<Widget>[
                    Text(l.detail!, style: text.bodySmall),
                    const SizedBox(width: AppSpacing.lg),
                  ],
                  SizedBox(
                    width: 100,
                    child: Text(Format.money(l.amount), textAlign: TextAlign.right, style: text.bodyMedium),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
