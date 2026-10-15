import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/ticket.dart';
import '../../providers/tickets_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/ticket_pdf.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/state_views.dart';
import '../../widgets/ticket_view.dart';

/// Ticket de servicio en pantalla con el botón "Imprimir" (administración y recepción).
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.ticketId});

  final int ticketId;

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<TicketsProvider>().load(widget.ticketId);
    });
  }

  Future<void> _print(Ticket ticket) async {
    try {
      // El PDF se genera en memoria; el diálogo del sistema permite imprimir o guardarlo.
      await Printing.layoutPdf(
        name: 'Ticket ${ticket.folio}',
        onLayout: (_) => buildTicketPdf(ticket),
      );
    } catch (_) {
      if (mounted) showAppSnackBar(context, 'No se pudo abrir la impresión.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final TicketsProvider provider = context.watch<TicketsProvider>();
    final Ticket? ticket = provider.ticket;

    Widget cuerpo;
    if (provider.loading || (ticket == null && provider.error == null)) {
      cuerpo = const LoadingView();
    } else if (ticket == null) {
      cuerpo = ErrorStateView(
        message: provider.error ?? 'No se pudo cargar el ticket.',
        onRetry: () => provider.load(widget.ticketId),
      );
    } else {
      cuerpo = SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    IconButton(
                      tooltip: 'Volver',
                      icon: const Icon(LucideIcons.arrowLeft, size: 20),
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        ticket.folio,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                    ),
                    Wrap(
                      spacing: AppSpacing.md,
                      children: <Widget>[
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context)
                              .pushNamed(AppRoutes.orderDetail, arguments: ticket.orderId),
                          icon: const Icon(LucideIcons.clipboardList, size: 18),
                          label: const Text('Ver orden'),
                        ),
                        FilledButton.icon(
                          onPressed: () => _print(ticket),
                          icon: const Icon(LucideIcons.printer, size: 18),
                          label: const Text('Imprimir'),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 560),
                    child: TicketView(ticket: ticket),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return AppShell(currentRoute: AppRoutes.orders, title: 'Ticket de servicio', child: cuerpo);
  }
}
