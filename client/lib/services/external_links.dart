import 'package:url_launcher/url_launcher.dart';

/// Abre una dirección en el navegador del sistema (por ejemplo, el ticket imprimible o el enlace de pago).
/// Es una variable para poder sustituirla en las pruebas sin abrir ventanas reales.
Future<bool> Function(Uri direccion) openExternalUrl = (direccion) => launchUrl(direccion, mode: LaunchMode.externalApplication);
