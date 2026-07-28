import 'package:flutter/material.dart';

abstract final class FolioColors {
  static const canvas = Color(0xFFF7F7F5);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF171717);
  static const muted = Color(0xFF626262);
  static const rule = Color(0xFFD8D8D4);
  static const accent = Color(0xFF1E5B4F);
  static const accentSoft = Color(0xFFE2EFEB);
  static const warning = Color(0xFF9A4D08);
  static const danger = Color(0xFFA12828);
}

abstract final class FolioTheme {
  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final canvas = dark ? Colors.black : FolioColors.canvas;
    final surface = dark ? const Color(0xFF0A0A0A) : FolioColors.surface;
    final ink = dark ? Colors.white : FolioColors.ink;
    final muted = dark ? const Color(0xFFB8B8B8) : FolioColors.muted;
    final rule = dark ? const Color(0xFF343434) : FolioColors.rule;
    final accent = dark ? const Color(0xFF79C9B6) : FolioColors.accent;
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: brightness,
      surface: surface,
      error: dark ? const Color(0xFFFF8E8E) : FolioColors.danger,
    );
    final base = ThemeData(
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: canvas,
      fontFamily: 'Switzer',
      useMaterial3: true,
    );
    return base.copyWith(
      dividerColor: rule,
      textTheme: base.textTheme.copyWith(
        headlineLarge: TextStyle(
          fontSize: 30,
          height: 1.15,
          fontWeight: FontWeight.w700,
          letterSpacing: -1.0,
          color: ink,
        ),
        headlineMedium: TextStyle(
          fontSize: 26,
          height: 1.2,
          fontWeight: FontWeight.w700,
          letterSpacing: -.7,
          color: ink,
        ),
        titleLarge: TextStyle(
          fontSize: 20,
          height: 1.25,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          height: 1.35,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        bodyLarge: TextStyle(fontSize: 16, height: 1.5, color: ink),
        bodyMedium: TextStyle(fontSize: 14, height: 1.45, color: muted),
        labelLarge: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: canvas,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        shape: Border(bottom: BorderSide(color: rule)),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: rule),
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: rule),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: rule),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: accent, width: 2),
        ),
        labelStyle: TextStyle(color: muted),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 52),
          side: BorderSide(color: rule),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: surface,
        indicatorColor: dark ? const Color(0xFF173D34) : FolioColors.accentSoft,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => TextStyle(
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: s.contains(WidgetState.selected) ? accent : muted,
          ),
        ),
      ),
    );
  }
}
