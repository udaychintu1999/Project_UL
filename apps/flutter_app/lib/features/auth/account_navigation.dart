import 'package:flutter/material.dart';
import '../../design/uluv_design.dart';

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
    this.profileComplete = false,
    this.navigationReady = true,
    this.dating = const SizedBox.shrink(),
    this.friendship = const SizedBox.shrink(),
    this.localFeed = const SizedBox.shrink(),
  });

  final int selectedIndex;
  final ValueChanged<int>? onSelect;
  final VoidCallback onBack;
  final Widget home;
  final Widget settings;
  final bool profileComplete;
  /// Hide navigation until the authenticated profile status has been checked.
  final bool navigationReady;
  final Widget dating, friendship, localFeed;

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
              Container(
                width: 33, height: 33,
                decoration: BoxDecoration(color: UluvPalette.pinkTint,
                  borderRadius: BorderRadius.circular(11)),
                child: Icon(Icons.favorite_rounded, color: colors.primary, size: 21),
              ),
              const SizedBox(width: 10),
              const Text('U_luv', style: TextStyle(fontWeight: FontWeight.w800,
                letterSpacing: -0.25)),
            ],
          ),
        ),
        body: SafeArea(
          child: IndexedStack(
            index: selectedIndex,
            children: [
              _AccountPage(
                key: const Key('p02-home-page'),
                heading: profileComplete ? 'Your home' : 'Your profile',
                caption: profileComplete
                    ? 'Your account, your choices.'
                    : 'A little about you goes a long way.',
                icon: Icons.person_outline_rounded,
                child: home,
              ),
              if (profileComplete) ...[
                _AccountPage(key: const Key('p03-dating-page'),
                  heading: 'Dating', caption: 'Connections on your terms.',
                  icon: Icons.favorite_outline, child: dating),
                _AccountPage(key: const Key('p03-friendship-page'),
                  heading: 'Friendship', caption: 'Meet people nearby.',
                  icon: Icons.people_outline, child: friendship),
                _AccountPage(key: const Key('p03-feed-page'),
                  heading: 'Local Feed', caption: 'Your local community.',
                  icon: Icons.dynamic_feed_outlined, child: localFeed),
              ],
              _AccountPage(
                key: const Key('p02-settings-page'),
                heading: 'Account & safety',
                caption: profileComplete
                    ? 'Your profile, privacy, preferences and account.'
                    : 'Your privacy, security and signed-in devices.',
                icon: Icons.tune_rounded,
                child: settings,
              ),
            ],
          ),
        ),
        bottomNavigationBar: navigationReady ? Container(
          decoration: const BoxDecoration(color: UluvPalette.paper,
            border: Border(top: BorderSide(color: UluvPalette.border))),
          child: NavigationBar(
            key: const Key('p02-bottom-navigation'),
            selectedIndex: selectedIndex,
            onDestinationSelected: onSelect,
            destinations: [
              const NavigationDestination(
                key: Key('p02-tab-home'),
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
              if (profileComplete) ...[
                const NavigationDestination(key: Key('p03-tab-dating'),
                  icon: Icon(Icons.favorite_border),
                  selectedIcon: Icon(Icons.favorite), label: 'Dating'),
                const NavigationDestination(key: Key('p03-tab-friendship'),
                  icon: Icon(Icons.people_outline),
                  selectedIcon: Icon(Icons.people), label: 'Friendship'),
                const NavigationDestination(key: Key('p03-tab-local-feed'),
                  icon: Icon(Icons.dynamic_feed_outlined),
                  selectedIcon: Icon(Icons.dynamic_feed), label: 'Local Feed'),
              ],
              const NavigationDestination(
                key: Key('p02-tab-settings'),
                icon: Icon(Icons.settings_outlined),
                selectedIcon: Icon(Icons.settings_rounded), label: 'Settings'),
            ],
          ),
        ) : null,
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
    return CustomScrollView(
      key: PageStorageKey<String>('p02-scroll-$heading'),
      slivers: [
        SliverToBoxAdapter(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 660),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 42),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    UluvStageBanner(
                      title: heading,
                      subtitle: caption,
                      icon: icon,
                      friendship: false,
                    ),
                    const SizedBox(height: 16),
                    UluvSectionCard(
                      child: child,
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
