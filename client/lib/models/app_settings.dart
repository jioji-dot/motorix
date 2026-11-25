/// Configuración del taller y márgenes de «Próximo» (Sprint 7). Solo la ve y la edita el administrador.
class AppSettings {
  const AppSettings({
    required this.workshopName,
    required this.workshopAddress,
    required this.workshopPhone,
    required this.warnDays,
    required this.warnKm,
    required this.defaultWarnDays,
    required this.defaultWarnKm,
  });

  final String workshopName;
  final String workshopAddress;
  final String workshopPhone;
  final int warnDays;
  final int warnKm;
  final int defaultWarnDays;
  final int defaultWarnKm;

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    final taller = json['workshop'] as Map<String, dynamic>;
    final mantenimiento = json['maintenance'] as Map<String, dynamic>;
    final valores = json['defaults'] as Map<String, dynamic>;
    return AppSettings(
      workshopName: taller['name'] as String,
      workshopAddress: taller['address'] as String,
      workshopPhone: taller['phone'] as String,
      warnDays: mantenimiento['warnDays'] as int,
      warnKm: mantenimiento['warnKm'] as int,
      defaultWarnDays: valores['warnDays'] as int,
      defaultWarnKm: valores['warnKm'] as int,
    );
  }
}
