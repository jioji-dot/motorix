/// Tipo de servicio del catálogo con su intervalo de mantenimiento (Sprint 7).
class ServiceType {
  const ServiceType({
    required this.id,
    required this.name,
    this.intervalDays,
    this.intervalKm,
    required this.active,
  });

  final int id;
  final String name;
  final int? intervalDays;
  final int? intervalKm;
  final bool active;

  /// Texto corto del intervalo, por ejemplo «180 días · 5,000 km».
  String get intervalLabel {
    String miles(int n) => n.toString().replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => ',',
    );
    return [
      if (intervalDays != null) '$intervalDays días',
      if (intervalKm != null) '${miles(intervalKm!)} km',
    ].join(' · ');
  }

  factory ServiceType.fromJson(Map<String, dynamic> json) => ServiceType(
    id: json['id'] as int,
    name: json['name'] as String,
    intervalDays: json['intervalDays'] as int?,
    intervalKm: json['intervalKm'] as int?,
    active: json['active'] as bool,
  );
}
