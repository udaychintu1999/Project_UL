import 'package:flutter/material.dart';

/// Authenticated P02-1 navigation. Pages remain mounted in IndexedStack so
/// switching to Settings cannot silently discard unsubmitted profile edits.
/// The parent authentication gate removes this entire tree on sign-out.
class AccountNavigation extends StatelessWidget {
  const AccountNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelect,
    required this.onBack,
    required this.home,
    required this.settings,
  });

  final int selectedIndex;
  final ValueChanged<int>? onSelect;
  final VoidCallback onBack;
  final Widget home;
  final Widget settings;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) onBack();
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          titleSpacing: 20,
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.favorite_rounded, color: colors.primary, size: 25),
              const SizedBox(width: 9),
              const Text('U_luv', style: TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
        ),
        body: SafeArea(
          child: IndexedStack(
            index: selectedIndex,
            children: [
              _AccountPage(
                key: const Key('p02-home-page'),
                heading: 'Your space',
                caption: 'Make your introduction feel like you.',
                icon: Icons.person_outline_rounded,
                child: home,
              ),
              _AccountPage(
                key: const Key('p02-settings-page'),
                heading: 'Settings',
                caption: 'Keep your account and signed-in devices secure.',
                icon: Icons.tune_rounded,
                child: settings,
              ),
            ],
          ),
        ),
        bottomNavigationBar: NavigationBar(
          key: const Key('p02-bottom-navigation'),
          selectedIndex: selectedIndex,
          onDestinationSelected: onSelect,
          destinations: const [
            NavigationDestination(
              key: Key('p02-tab-home'),
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Home',
            ),
            NavigationDestination(
              key: Key('p02-tab-settings'),
              icon: Icon(Icons.settings_outlined),
              selectedIcon: Icon(Icons.settings_rounded),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }
}

class _AccountPage extends StatelessWidget {
  const _AccountPage({
    super.key,
    required this.heading,
    required this.caption,
    required this.icon,
    required this.child,
  });

  final String heading;
  final String caption;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return CustomScrollView(
      key: PageStorageKey<String>('p02-scroll-$heading'),
      slivers: [
        SliverToBoxAdapter(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 660),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 36),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: colors.primaryContainer,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Icon(icon, color: colors.onPrimaryContainer),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(heading, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text(caption, style: theme.textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Card(
                      margin: EdgeInsets.zero,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        side: BorderSide(color: colors.outlineVariant),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: child,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
