import 'package:flutter/foundation.dart';

import '../models/terms.dart';
import '../services/api_client.dart';
import '../utils/error_text.dart';

/// Gestión de los términos y condiciones por el administrador: versión vigente, quién aceptó y publicación (Sprint 7).
class TermsAdminProvider extends ChangeNotifier {
  TermsAdminProvider(this.api);

  final ApiClient api;

  TermsInfo? current;
  TermsAcceptances? acceptances;
  bool loading = false;
  String? error;

  void reset() {
    current = null;
    acceptances = null;
    loading = false;
    error = null;
    notifyListeners();
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final vigente = await api.get('/terms/current') as Map<String, dynamic>;
      final datos = vigente['data'] as Map<String, dynamic>?;
      current = datos == null ? null : TermsInfo.fromJson(datos);
      final lista = await api.get('/terms/acceptances') as Map<String, dynamic>;
      acceptances = TermsAcceptances.fromJson(
        lista['data'] as Map<String, dynamic>,
      );
    } on ApiException catch (e) {
      error = e.message;
    } catch (_) {
      error = 'No se pudo leer la respuesta del servidor. Intenta de nuevo.';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Publica una versión nueva. Devuelve el mensaje de error o nulo si salió bien.
  Future<String?> publish({
    required String termsText,
    required String privacyText,
  }) async {
    try {
      await api.post(
        '/terms',
        body: {'termsText': termsText, 'privacyText': privacyText},
      );
    } catch (e) {
      return errorText(e);
    }
    await load();
    return null;
  }
}
