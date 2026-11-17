import 'package:flutter/material.dart';
import '../../design/uluv_design.dart';

/// P03 owner-approved completed navigation has FIVE destinations:
/// Dating, Friendship, Local Feed (with Activities), Connects and Settings.
/// An incomplete account temporarily sees Dating/setup and Settings only.
/// There is no separate Home destination; Settings owns the profile editor.
/// IndexedStack keeps unsubmitted editor state while switching destinations.
class AccountNavigation extends StatelessWidget {
  const AccountNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelect,
    required this.onBack,
    required this.home, // Legacy name: incomplete Dating/setup content.
    required this.settings,
    this.profileComplete = false,
    this.navigationReady = true,
    this.dating = const SizedBox.shrink(),
    this.friendship = const SizedBox.shrink(),
    this.connects = const SizedBox.shrink(),
    this.localFeed = const SizedBox.shrink(), // Combined Local Feed / Activities tab.
  });

  final int selectedIndex;
  final ValueChanged<int>? onSelect;
  final VoidCallback onBack;
  final Widget home;
  final Widget settings;
  final bool profileComplete;
  final bool navigationReady;
  final Widget dating, friendship, connects, localFeed;

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
          title: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 33, height: 33,
              decoration: BoxDecoration(
                color: UluvPalette.pinkTint,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(Icons.favorite_rounded, color: colors.primary, size: 21),
            ),
            const SizedBox(width: 10),
            const Text('U_luv', style: TextStyle(
              fontWeight: FontWeight.w800, letterSpacing: -0.25)),
          ]),
        ),
        body: SafeArea(
          child: IndexedStack(
            index: selectedIndex,
            children: [
              _AccountPage(
                key: const Key('p03-dating-page'),
                heading: 'Dating',
                caption: profileComplete ? '' : 'Complete your profile to get started.',
                icon: Icons.favorite_outline,
                child: profileComplete ? dating : home,
              ),
              if (profileComplete) ...[
                _AccountPage(
                  key: const Key('p03-friendship-page'),
                  heading: 'Friendship', caption: '',
                  icon: Icons.people_outline, child: friendship,
                ),
                _AccountPage(
                  key: const Key('p03-local-feed-activities-page'),
                  heading: 'Local Feed & Activities', caption: '',
                  icon: Icons.article_outlined, child: localFeed,
                ),
                _AccountPage(
                  key: const Key('p03-connects-page'),
                  heading: 'Connects', caption: '',
                  icon: Icons.chat_bubble_outline, child: connects,
                ),
              ],
              _AccountPage(
                key: const Key('p02-settings-page'),
                heading: 'Settings', caption: '',
                icon: Icons.settings_outlined,
                compact: true, child: settings,
              ),
            ],
          ),
        ),
        bottomNavigationBar: navigationReady ? Container(
          decoration: const BoxDecoration(
            color: UluvPalette.paper,
            border: Border(top: BorderSide(color: UluvPalette.border)),
          ),
          child: NavigationBar(
            key: const Key('p02-bottom-navigation'),
            selectedIndex: selectedIndex,
            onDestinationSelected: onSelect,
            destinations: [
              NavigationDestination(
                // Keep the old key on the two-destination setup shell for
                // legacy integration harnesses. The visible label is Dating.
                key: profileComplete
                    ? const Key('p03-tab-dating')
                    : const Key('p02-tab-home'),
                icon: const Icon(Icons.favorite_border),
                selectedIcon: const Icon(Icons.favorite),
                label: 'Dating',
              ),
              if (profileComplete) ...[
                const NavigationDestination(
                  key: Key('p03-tab-friendship'),
                  icon: Icon(Icons.people_outline),
                  selectedIcon: Icon(Icons.people), label: 'Friendship',
                ),
                const NavigationDestination(
                  key: Key('p03-tab-local-feed-activities'),
                  icon: Icon(Icons.article_outlined),
                  selectedIcon: Icon(Icons.article_rounded), label: 'Local Feed',
                ),
                const NavigationDestination(
                  key: Key('p03-tab-connects'),
                  icon: Icon(Icons.chat_bubble_outline),
                  selectedIcon: Icon(Icons.chat_bubble), label: 'Connects',
                ),
              ],
              const NavigationDestination(
                key: Key('p02-tab-settings'),
                icon: Icon(Icons.settings_outlined),
                selectedIcon: Icon(Icons.settings_rounded), label: 'Settings',
              ),
            ],
          ),
        ) : null,
      ),
    );
  }
}

class _AccountPage extends StatelessWidget {
  const _AccountPage({super.key, required this.heading,
    required this.caption, required this.icon, required this.child,
    this.compact = false});

  final String heading, caption;
  final IconData icon;
  final Widget child;
  final bool compact;

  @override
  Widget build(BuildContext context) => CustomScrollView(
    key: PageStorageKey<String>('p03-scroll-$heading'),
    slivers: [SliverToBoxAdapter(
      child: Center(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 660),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (compact)
              Padding(padding: const EdgeInsets.only(bottom: 12),
                child: Text(heading,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700))),
            if (!compact) ...[
              UluvStageBanner(title: heading,
                subtitle: caption.isEmpty ? ' ' : caption,
                icon: icon, friendship: heading == 'Friendship'),
              const SizedBox(height: 12),
            ],
            if (compact) child else UluvSectionCard(child: child),
          ]),
        ),
      )),
    )],
  );
}
