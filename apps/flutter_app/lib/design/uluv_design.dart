import 'package:flutter/material.dart';

/// P02-5 visual tokens. Reference: UI pack S01-S16 and S65-S66.
/// Colors are presentation only: mode activation, saved-state gates and privacy
/// decisions remain owned by the existing repositories and backend.
abstract final class UluvPalette {
  static const Color blush = Color(0xFFFFF7F6);
  static const Color paper = Color(0xFFFFFDFC);
  static const Color ink = Color(0xFF24222B);
  static const Color muted = Color(0xFF716B77);
  static const Color border = Color(0xFFF1E3E5);
  static const Color pink = Color(0xFFFF4E7A);
  static const Color pinkAction = Color(0xFFCD275C);
  static const Color pinkTint = Color(0xFFFFECF1);
  static const Color teal = Color(0xFF00866F);
  static const Color tealTint = Color(0xFFE0F8F1);
  static const Color danger = Color(0xFFC12C55);
}

abstract final class UluvTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: UluvPalette.pink,
      brightness: Brightness.light,
    ).copyWith(
      primary: UluvPalette.pinkAction,
      onPrimary: Colors.white,
      secondary: UluvPalette.teal,
      surface: UluvPalette.paper,
      onSurface: UluvPalette.ink,
      onSurfaceVariant: UluvPalette.muted,
      outline: UluvPalette.border,
      outlineVariant: UluvPalette.border,
      error: UluvPalette.danger,
    );
    final rounded = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: UluvPalette.blush,
      canvasColor: UluvPalette.blush,
      dividerColor: UluvPalette.border,
      splashColor: UluvPalette.pinkTint,
      textTheme: const TextTheme(
        headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w800,
          color: UluvPalette.ink, letterSpacing: -0.7),
        headlineSmall: TextStyle(fontSize: 25, fontWeight: FontWeight.w800,
          color: UluvPalette.ink, letterSpacing: -0.45),
        titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
          color: UluvPalette.ink, letterSpacing: -0.35),
        titleMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w700,
          color: UluvPalette.ink),
        bodyLarge: TextStyle(fontSize: 16, height: 1.35,
          color: UluvPalette.ink),
        bodyMedium: TextStyle(fontSize: 14, height: 1.4,
          color: UluvPalette.ink),
        bodySmall: TextStyle(fontSize: 12.5, height: 1.4,
          color: UluvPalette.muted),
      ),
      appBarTheme: const AppBarThemeData(
        backgroundColor: UluvPalette.paper,
        foregroundColor: UluvPalette.ink,
        centerTitle: true,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(color: UluvPalette.ink,
          fontSize: 18, fontWeight: FontWeight.w800),
      ),
      cardTheme: CardThemeData(
        color: UluvPalette.paper,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: UluvPalette.border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: UluvPalette.pinkAction,
          foregroundColor: Colors.white,
          disabledBackgroundColor: const Color(0xFFEAD6DC),
          disabledForegroundColor: UluvPalette.muted,
          minimumSize: const Size(48, 50),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
          shape: const StadiumBorder(),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: UluvPalette.pinkAction,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
          side: const BorderSide(color: Color(0xFFF0B6C6)),
          shape: const StadiumBorder(),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: UluvPalette.pinkAction,
          minimumSize: const Size(48, 44),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationThemeData(
        filled: true,
        fillColor: UluvPalette.paper,
        labelStyle: const TextStyle(color: UluvPalette.muted),
        hintStyle: const TextStyle(color: UluvPalette.muted),
        helperStyle: const TextStyle(color: UluvPalette.muted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: UluvPalette.border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: UluvPalette.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: UluvPalette.pinkAction, width: 1.6)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: UluvPalette.danger)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: UluvPalette.danger, width: 1.6)),
      ),
      chipTheme: const ChipThemeData(
        backgroundColor: UluvPalette.paper,
        selectedColor: UluvPalette.pinkTint,
        disabledColor: UluvPalette.blush,
        side: const BorderSide(color: UluvPalette.border),
        shape: const StadiumBorder(),
        labelStyle: const TextStyle(fontWeight: FontWeight.w600,
          color: UluvPalette.ink),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: UluvPalette.paper,
        indicatorColor: UluvPalette.pinkTint,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 72,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: UluvPalette.paper,
        shape: rounded,
      ),
    );
  }
}

/// Shared presentation-only section wrapper. Does not intercept gestures or
/// own business state; existing form keys and callbacks stay on their children.
class UluvSectionCard extends StatelessWidget {
  const UluvSectionCard({super.key, required this.child,
    this.tint = UluvPalette.paper, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final Color tint;
  final EdgeInsetsGeometry padding;

  // SwitchListTile/ListTile draw their selection and ink reactions on the
  // closest Material. A colored DecoratedBox between the tile and Material
  // hides those reactions and triggers Flutter debug assertions. Keep the
  // surface, rounded border and clipping on the Material itself.
  @override
  Widget build(BuildContext context) => Material(
    color: tint,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: const BorderSide(color: UluvPalette.border),
    ),
    clipBehavior: Clip.antiAlias,
    child: Padding(padding: padding, child: child),
  );
}

class UluvStageBanner extends StatelessWidget {
  const UluvStageBanner({super.key, required this.title,
    required this.subtitle, this.icon = Icons.favorite_border_rounded,
    this.friendship = false});
  final String title;
  final String subtitle;
  final IconData icon;
  final bool friendship;

  @override
  Widget build(BuildContext context) {
    final color = friendship ? UluvPalette.teal : UluvPalette.pinkAction;
    final background = friendship ? UluvPalette.tealTint : UluvPalette.pinkTint;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: background,
        borderRadius: BorderRadius.circular(20)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Container(width: 44, height: 44,
          decoration: BoxDecoration(color: UluvPalette.paper,
            borderRadius: BorderRadius.circular(15)),
          child: Icon(icon, color: color, size: 24)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 3),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ])),
      ]),
    );
  }
}

class UluvStatusNotice extends StatelessWidget {
  const UluvStatusNotice({super.key, required this.message,
    this.warning = false});
  final String message;
  final bool warning;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
      decoration: BoxDecoration(
        color: warning ? const Color(0xFFFFE9EE) : UluvPalette.tealTint,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: warning
          ? const Color(0xFFF5A8BC) : const Color(0xFFA5E7D8)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(warning ? Icons.error_outline_rounded : Icons.check_circle_outline,
          size: 18, color: warning ? UluvPalette.danger : UluvPalette.teal),
        const SizedBox(width: 8),
        Expanded(child: Text(message, style: TextStyle(
          fontWeight: warning ? FontWeight.w800 : FontWeight.w600,
          color: warning ? UluvPalette.danger : UluvPalette.ink,
          height: 1.35))),
      ]),
    ),
  );
}
