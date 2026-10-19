import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tokens de color del sistema de diseño (docs/design-system.md, sección 5).
/// Las pantallas nunca escriben valores sueltos: todo sale de estas clases.
class AppColors {
  AppColors._();

  static const primary = Color(0xFF9B4F55);
  static const sidebar = Color(0xFF2B2325);
  static const sidebarActive = Color(0xFF43353A);
  static const background = Color(0xFFF5F2F1);
  static const surface = Color(0xFFFFFFFF);
  static const outline = Color(0xFFDDD5D4);
  static const textPrimary = Color(0xFF231F20);
  static const textSecondary = Color(0xFF6F6566);
  static const warning = Color(0xFFC9892B);
  static const success = Color(0xFF4F7A5A);
  static const danger = Color(0xFFC0392B);
  static const onSidebar = Color(0xFFF1EBEA);
  static const onSidebarMuted = Color(0xFFB9AEB0);
}

/// Escala de espaciado de 4 px.
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

/// Radios de borde.
class AppRadius {
  AppRadius._();

  static const double control = 6; // botones e inputs
  static const double panel = 8; // paneles, tarjetas, chips y diálogos
  static const double pill = 12; // elementos tipo "pill"
}

/// Duraciones y curvas de movimiento (sección 6.4).
class AppMotion {
  AppMotion._();

  static const state = Duration(milliseconds: 150);
  static const appear = Duration(milliseconds: 200);
  static const navigation = Duration(milliseconds: 250);
  static const sidebar = Duration(milliseconds: 200);
  static const curve = Curves.easeInOut;
}

/// Escala tipográfica fija de 4 tamaños.
class AppText {
  AppText._();

  static const double caption = 12;
  static const double body = 14;
  static const double section = 18;
  static const double page = 28;
}

/// Construye el tema propio de Motorix sobre Material 3.
/// [useGoogleFonts] se desactiva en las pruebas para no requerir red.
ThemeData buildAppTheme({bool useGoogleFonts = true}) {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    brightness: Brightness.light,
  ).copyWith(
    primary: AppColors.primary,
    onPrimary: Colors.white,
    surface: AppColors.surface,
    onSurface: AppColors.textPrimary,
    outline: AppColors.outline,
    error: AppColors.danger,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: Brightness.light);

  TextStyle estilo(double tamano, FontWeight peso, {Color color = AppColors.textPrimary}) {
    final style = TextStyle(fontSize: tamano, fontWeight: peso, color: color, height: 1.4);
    return useGoogleFonts ? GoogleFonts.ibmPlexSans(textStyle: style) : style;
  }

  final textTheme = base.textTheme.copyWith(
    displaySmall: estilo(AppText.page, FontWeight.w600),
    headlineMedium: estilo(AppText.page, FontWeight.w600),
    titleLarge: estilo(AppText.section, FontWeight.w600),
    titleMedium: estilo(AppText.section, FontWeight.w600),
    titleSmall: estilo(AppText.body, FontWeight.w500),
    bodyLarge: estilo(AppText.body, FontWeight.w400),
    bodyMedium: estilo(AppText.body, FontWeight.w400),
    bodySmall: estilo(AppText.caption, FontWeight.w400, color: AppColors.textSecondary),
    labelLarge: estilo(AppText.body, FontWeight.w500),
    labelMedium: estilo(AppText.caption, FontWeight.w500),
    labelSmall: estilo(AppText.caption, FontWeight.w400, color: AppColors.textSecondary),
  );

  final controlShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control));
  final panelShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(AppRadius.panel),
    side: const BorderSide(color: AppColors.outline),
  );

  OutlineInputBorder borde(Color color) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: BorderSide(color: color),
      );

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.background,
    textTheme: textTheme,
    dividerTheme: const DividerThemeData(color: AppColors.outline, thickness: 1, space: 1),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.macOS: FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
      TargetPlatform.iOS: FadeUpwardsPageTransitionsBuilder(),
    }),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: AppColors.sidebar,
      indicatorColor: AppColors.sidebarActive,
      indicatorShape: controlShape,
      selectedIconTheme: const IconThemeData(color: AppColors.onSidebar, size: 20),
      unselectedIconTheme: const IconThemeData(color: AppColors.onSidebarMuted, size: 20),
      selectedLabelTextStyle: estilo(AppText.body, FontWeight.w500, color: AppColors.onSidebar),
      unselectedLabelTextStyle: estilo(AppText.body, FontWeight.w400, color: AppColors.onSidebarMuted),
    ),
    dataTableTheme: DataTableThemeData(
      headingRowColor: const WidgetStatePropertyAll(AppColors.background),
      headingTextStyle: estilo(AppText.caption, FontWeight.w600, color: AppColors.textSecondary),
      dataTextStyle: estilo(AppText.body, FontWeight.w400),
      dividerThickness: 1,
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.panel)),
      side: BorderSide.none,
      labelStyle: estilo(AppText.caption, FontWeight.w500),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
      border: borde(AppColors.outline),
      enabledBorder: borde(AppColors.outline),
      focusedBorder: borde(AppColors.primary),
      errorBorder: borde(AppColors.danger),
      focusedErrorBorder: borde(AppColors.danger),
      labelStyle: estilo(AppText.body, FontWeight.w400, color: AppColors.textSecondary),
      errorStyle: estilo(AppText.caption, FontWeight.w400, color: AppColors.danger),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: controlShape,
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        textStyle: estilo(AppText.body, FontWeight.w500, color: Colors.white),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: const BorderSide(color: AppColors.outline),
        shape: controlShape,
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        textStyle: estilo(AppText.body, FontWeight.w500),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        shape: controlShape,
        textStyle: estilo(AppText.body, FontWeight.w500, color: AppColors.primary),
      ),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: panelShape,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      elevation: 0,
      shape: panelShape,
      titleTextStyle: estilo(AppText.section, FontWeight.w600),
      contentTextStyle: estilo(AppText.body, FontWeight.w400),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.sidebar,
      contentTextStyle: estilo(AppText.body, FontWeight.w400, color: AppColors.onSidebar),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.panel)),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: AppColors.sidebar,
        borderRadius: BorderRadius.circular(AppRadius.control),
      ),
      textStyle: estilo(AppText.caption, FontWeight.w400, color: AppColors.onSidebar),
      waitDuration: AppMotion.state,
    ),
  );
}
