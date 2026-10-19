import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/payment.dart';
import '../models/ticket.dart';
import '../providers/payments_provider.dart';
import '../services/api_client.dart';
import '../services/external_links.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/button_spinner.dart';
import '../widgets/state_views.dart';

/// Ticket de servicio de una orden: se genera (un solo folio por orden) y se puede imprimir desde el navegador del sistema.
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  Ticket? _ticket;
  bool _loading = true;
  bool _printing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Generar es idempotente: si ya existe, devuelve el mismo folio con el estado de pago actual.
      final ticket = await context.read<PaymentsProvider>().generateTicket(widget.orderId);
      if (mounted) setState(() => _ticket = ticket);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _imprimir() async {
    setState(() => _printing = true);
    try {
      final direccion = await context.read<PaymentsProvider>().printLink(widget.orderId);
      final abierto = await openExternalUrl(direccion);
      if (mounted && !abierto) showFeedback(context, 'No se pudo abrir el navegador para imprimir el ticket.', error: true);
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _printing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_ticket?.folio ?? 'Ticket de servicio'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _ticket == null) return const LoadingState(message: 'Generando ticket...');
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    final t = _ticket!;
    final texto = Theme.of(context).textTheme;

    Widget fila(String etiqueta, String valor, {TextStyle? estilo}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(etiqueta, style: estilo ?? texto.bodySmall),
              const SizedBox(width: AppSpacing.lg),
              Expanded(child: Text(valor, textAlign: TextAlign.right, style: estilo ?? texto.bodyLarge)),
            ],
          ),
        );

    Widget titulo(String t) => Padding(
          padding: const EdgeInsets.only(top: AppSpacing.lg, bottom: AppSpacing.xs),
          child: Text(t, style: texto.titleSmall),
        );

    Widget linea(String descripcion, String importe, {String? detalle}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            children: [
              Expanded(child: Text(detalle == null ? descripcion : '$descripcion · $detalle', overflow: TextOverflow.ellipsis, maxLines: 2)),
              const SizedBox(width: AppSpacing.md),
              Text(formatMoney(importe)),
            ],
          ),
        );

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Card(
            key: const Key('tarjeta-ticket'),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(t.workshopName, style: texto.titleLarge, textAlign: TextAlign.center),
                  Text('${t.workshopAddress}\n${t.workshopPhone}', style: texto.bodySmall, textAlign: TextAlign.center),
                  const Divider(height: AppSpacing.xl),
                  fila('Ticket', t.folio),
                  fila('Orden', t.orderFolio),
                  fila('Fecha', formatDateTime(t.generatedAt)),
                  fila('Cliente', t.clientName),
                  fila('Vehículo', t.vehicleDescription),
                  fila('Placas', t.licensePlate),
                  fila('Kilometraje', formatMileage(t.mileage)),
                  if (t.services.isNotEmpty) ...[titulo('Servicios'), for (final s in t.services) linea(s.description, s.amount)],
                  if (t.labor.isNotEmpty) ...[
                    titulo('Mano de obra'),
                    for (final l in t.labor) linea(l.description, l.amount, detalle: '${l.hours} h × ${formatMoney(l.hourlyRate)}'),
                  ],
                  if (t.parts.isNotEmpty) ...[
                    titulo('Refacciones'),
                    for (final p in t.parts) linea(p.name, p.amount, detalle: '${p.quantity} × ${formatMoney(p.unitPrice)}'),
                  ],
                  const Divider(height: AppSpacing.xl),
                  fila('Subtotal', formatMoney(t.subtotal)),
                  fila('Total', formatMoney(t.total), estilo: texto.titleMedium),
                  fila('Método de pago', paymentMethodsText(t.paymentMethods)),
                  fila('Estado del pago', collectionStatusLabel(t.paymentStatus)),
                  fila('Pagado', formatMoney(t.paid)),
                  fila('Saldo', formatMoney(t.balance)),
                  const SizedBox(height: AppSpacing.lg),
                  FilledButton(
                    key: const Key('boton-imprimir'),
                    onPressed: _printing ? null : _imprimir,
                    child: _printing ? const ButtonSpinner() : const Text('Imprimir'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Se abre en el navegador, donde también puedes guardarlo como PDF.',
                    style: texto.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
