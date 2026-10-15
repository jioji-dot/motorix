import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tokens de color del sistema de diseño (`docs/design-system.md`, sección 5).
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF9B4F55);
  static const Color sidebar = Color(0xFF2B2325);
  static const Color sidebarActive = Color(0xFF43353A);
  static const Color background = Color(0xFFF5F2F1);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color outline = Color(0xFFDDD5D4);
  static const Color textPrimary = Color(0xFF231F20);
  static const Color textSecondary = Color(0xFF6F6566);
  static const Color warning = Color(0xFFC9892B);
  static const Color success = Color(0xFF4F7A5A);
  static const Color danger = Color(0xFFC0392B);

  /// Texto e íconos sobre el color primario (botones principales).
  static const Color onPrimary = Color(0xFFFFFFFF);

  /// Texto e íconos claros sobre el sidebar oscuro.
  static const Color onSidebar = Color(0xFFF5F2F1);
  static const Color onSidebarMuted = Color(0xFFB8AEAF);
}

/// Escala de espaciado base de 4 px (sección 6.2).
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

/// Radios de borde (sección 6.3).
class AppRadius {
  AppRadius._();

  static const double control = 6;
  static const double panel = 8;
  static const double pill = 12;

  static BorderRadius get controlBorder => BorderRadius.circular(control);
  static BorderRadius get panelBorder => BorderRadius.circular(panel);
}

/// Duraciones y curvas de movimiento (sección 6.4).
class AppMotion {
  AppMotion._();

  static const Duration state = Duration(milliseconds: 150);
  static const Duration appear = Duration(milliseconds: 200);
  static const Duration navigation = Duration(milliseconds: 250);
  static const Duration sidebar = Duration(milliseconds: 200);
  static const Curve curve = Curves.easeInOut;
}

/// Anchos del sidebar (sección 7).
class AppLayout {
  AppLayout._();

  static const double sidebarExpanded = 260;
  static const double sidebarCollapsed = 72;
  static const double collapseBreakpoint = 1000;
}

/// Escala tipográfica fija de 4 tamaños (sección 6.1).
class AppText {
  AppText._();

  static const double caption = 12;
  static const double body = 14;
  static const double section = 18;
  static const double title = 28;
}

/// Tema de Material 3 propio de Motorix: única fuente de estilos de la aplicación.
///
/// [useGoogleFonts] se puede desactivar en pruebas para no descargar la fuente.
ThemeData buildAppTheme({bool useGoogleFonts = true}) {
  final ColorScheme scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: Brightness.light,
  ).copyWith(
    primary: AppColors.primary,
    surface: AppColors.surface,
    surfaceContainerLowest: AppColors.background,
    outlineVariant: AppColors.outline,
    outline: AppColors.outline,
    onSurface: AppColors.textPrimary,
    error: AppColors.danger,
  );

  TextStyle base(double size, FontWeight weight, {Color? color}) {
    final TextStyle estilo = TextStyle(
      fontSize: size,
      fontWeight: weight,
      color: color ?? AppColors.textPrimary,
    );
    return useGoogleFonts ? GoogleFonts.ibmPlexSans(textStyle: estilo) : estilo;
  }

  final TextTheme textTheme = TextTheme(
    // Indicador grande / título de página.
    headlineMedium: base(AppText.title, FontWeight.w600),
    // Título de sección.
    titleMedium: base(AppText.section, FontWeight.w600),
    // Cuerpo.
    bodyMedium: base(AppText.body, FontWeight.w400),
    bodyLarge: base(AppText.body, FontWeight.w500),
    labelLarge: base(AppText.body, FontWeight.w500),
    // Caption / etiquetas.
    bodySmall: base(AppText.caption, FontWeight.w400, color: AppColors.textSecondary),
    labelMedium: base(AppText.caption, FontWeight.w400, color: AppColors.textSecondary),
  );

  final OutlineInputBorder bordeBase = OutlineInputBorder(
    borderRadius: AppRadius.controlBorder,
    borderSide: const BorderSide(color: AppColors.outline),
  );

  final RoundedRectangleBorder formaControl =
      RoundedRectangleBorder(borderRadius: AppRadius.controlBorder);

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.background,
    textTheme: textTheme,
    dividerTheme: const DividerThemeData(color: AppColors.outline, thickness: 1, space: 1),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.panelBorder,
        side: const BorderSide(color: AppColors.outline),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.panelBorder,
        side: const BorderSide(color: AppColors.outline),
      ),
      titleTextStyle: base(AppText.section, FontWeight.w600),
      contentTextStyle: base(AppText.body, FontWeight.w400),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.sidebar,
      contentTextStyle: base(AppText.body, FontWeight.w400, color: AppColors.onSidebar),
      shape: RoundedRectangleBorder(borderRadius: AppRadius.panelBorder),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      border: bordeBase,
      enabledBorder: bordeBase,
      focusedBorder: bordeBase.copyWith(
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: bordeBase.copyWith(borderSide: const BorderSide(color: AppColors.danger)),
      focusedErrorBorder: bordeBase.copyWith(
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
      labelStyle: base(AppText.body, FontWeight.w400, color: AppColors.textSecondary),
      errorStyle: base(AppText.caption, FontWeight.w400, color: AppColors.danger),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        shape: formaControl,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        textStyle: base(AppText.body, FontWeight.w500),
        animationDuration: AppMotion.state,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: const BorderSide(color: AppColors.outline),
        shape: formaControl,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        textStyle: base(AppText.body, FontWeight.w500),
        animationDuration: AppMotion.state,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        shape: formaControl,
        textStyle: base(AppText.body, FontWeight.w500),
        animationDuration: AppMotion.state,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.background,
      side: const BorderSide(color: AppColors.outline),
      shape: RoundedRectangleBorder(borderRadius: AppRadius.panelBorder),
      labelStyle: base(AppText.caption, FontWeight.w500),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
    ),
    dataTableTheme: DataTableThemeData(
      headingRowColor: const WidgetStatePropertyAll<Color>(AppColors.background),
      headingTextStyle: base(AppText.caption, FontWeight.w600, color: AppColors.textSecondary),
      dataTextStyle: base(AppText.body, FontWeight.w400),
      dividerThickness: 1,
      dataRowColor: WidgetStateProperty.resolveWith<Color?>((Set<WidgetState> estados) {
        if (estados.contains(WidgetState.hovered)) {
          return AppColors.background;
        }
        return null;
      }),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: AppColors.sidebar,
      indicatorColor: AppColors.sidebarActive,
      selectedIconTheme: const IconThemeData(color: AppColors.onSidebar),
      unselectedIconTheme: const IconThemeData(color: AppColors.onSidebarMuted),
      selectedLabelTextStyle: base(AppText.body, FontWeight.w500, color: AppColors.onSidebar),
      unselectedLabelTextStyle:
          base(AppText.body, FontWeight.w400, color: AppColors.onSidebarMuted),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: AppColors.sidebar,
        borderRadius: AppRadius.controlBorder,
      ),
      textStyle: base(AppText.caption, FontWeight.w400, color: AppColors.onSidebar),
      waitDuration: const Duration(milliseconds: 400),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: <TargetPlatform, PageTransitionsBuilder>{
        TargetPlatform.windows: _SuavePageTransitionsBuilder(),
        TargetPlatform.linux: _SuavePageTransitionsBuilder(),
        TargetPlatform.macOS: _SuavePageTransitionsBuilder(),
        TargetPlatform.android: _SuavePageTransitionsBuilder(),
        TargetPlatform.iOS: _SuavePageTransitionsBuilder(),
      },
    ),
  );
}

/// Transición discreta entre pantallas: desvanecimiento con un desplazamiento leve.
class _SuavePageTransitionsBuilder extends PageTransitionsBuilder {
  const _SuavePageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    // Respeta la preferencia del sistema de reducir el movimiento.
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return child;

    final CurvedAnimation curva =
        CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curva,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.02), end: Offset.zero).animate(curva),
        child: child,
      ),
    );
  }
}
