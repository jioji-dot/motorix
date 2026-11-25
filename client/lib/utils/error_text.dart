import '../services/api_client.dart';

/// Texto de un error de la API para mostrar a la persona: junta los mensajes de cada campo si los hay.
String errorText(Object error) {
  if (error is ApiException) {
    final mensajes = error.details
        .map((d) => d['message'])
        .whereType<String>()
        .toList();
    return mensajes.isEmpty ? error.message : mensajes.join(' ');
  }
  return 'No se pudo completar la acción. Intenta de nuevo.';
}
