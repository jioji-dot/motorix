/// Versión vigente de los términos y condiciones y del aviso de privacidad (Sprint 7).
class TermsInfo {
  const TermsInfo({
    required this.version,
    required this.termsText,
    required this.privacyText,
    required this.publishedAt,
    required this.accepted,
  });

  final int version;
  final String termsText;
  final String privacyText;
  final DateTime? publishedAt;

  /// Si el usuario actual ya aceptó esta versión.
  final bool accepted;

  factory TermsInfo.fromJson(Map<String, dynamic> json) => TermsInfo(
    version: json['version'] as int,
    termsText: json['termsText'] as String,
    privacyText: json['privacyText'] as String,
    publishedAt: DateTime.tryParse((json['publishedAt'] as String?) ?? '')
        ?.toLocal(),
    accepted: json['accepted'] as bool? ?? false,
  );
}

/// Persona que aceptó (con fecha) o que falta por aceptar (sin fecha) la versión vigente.
class TermsAcceptance {
  const TermsAcceptance({
    required this.userId,
    required this.name,
    this.acceptedAt,
  });

  final int userId;
  final String name;
  final DateTime? acceptedAt;

  factory TermsAcceptance.fromJson(Map<String, dynamic> json) =>
      TermsAcceptance(
        userId: json['userId'] as int,
        name: json['name'] as String,
        acceptedAt: DateTime.tryParse((json['acceptedAt'] as String?) ?? '')
            ?.toLocal(),
      );
}

/// Quién aceptó y quién no la versión vigente.
class TermsAcceptances {
  const TermsAcceptances({
    required this.version,
    required this.accepted,
    required this.pending,
  });

  final int? version;
  final List<TermsAcceptance> accepted;
  final List<TermsAcceptance> pending;

  factory TermsAcceptances.fromJson(Map<String, dynamic> json) =>
      TermsAcceptances(
        version: json['version'] as int?,
        accepted: (json['accepted'] as List<dynamic>)
            .map((e) => TermsAcceptance.fromJson(e as Map<String, dynamic>))
            .toList(),
        pending: (json['pending'] as List<dynamic>)
            .map((e) => TermsAcceptance.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
