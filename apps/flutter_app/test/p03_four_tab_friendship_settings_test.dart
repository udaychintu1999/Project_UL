import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/account_navigation.dart';
import 'package:uluv/features/geo/friendship_sections.dart';
import 'package:uluv/features/geo/local_feed_activities_sections.dart';

void main() {
  testWidgets('five ordered tabs; Local Feed and Activities share the third tab',
      (tester) async {
    var selected = 0;
    await tester.pumpWidget(MaterialApp(home: StatefulBuilder(
      builder: (context, change) => AccountNavigation(
        selectedIndex: selected,
        onSelect: (next) => change(() => selected = next),
        onBack: () => change(() => selected = 0),
        profileComplete: true,
        home: const Text('Onboarding, only before completion'),
        dating: const Text('Dating account view'),
        friendship: FriendshipSections(
          baseUrl: 'http://127.0.0.1:3000', access: () async => 'test-access',
          active: false, refreshEpoch: 0, onLocationSaved: (_) {},
        ),
        localFeed: LocalFeedActivitiesSections(
          baseUrl: 'http://127.0.0.1:3000', access: () async => 'test-access',
          active: false, refreshEpoch: 0, onLocationSaved: (_) {},
        ),
        connects: const Text('Connects placeholder'),
        settings: const Text('Settings content'),
      ),
    )));
    expect(find.byType(NavigationDestination), findsNWidgets(5));
    expect(find.text('Home'), findsNothing);
    await tester.tap(find.byKey(const Key('p03-tab-friendship')));
    await tester.pump();
    expect(selected, 1);
    expect(find.byKey(const Key('p03-friendship-people-only')), findsOneWidget);
    expect(find.byKey(const Key('p03-local-sections')), findsNothing);
    await tester.tap(find.byKey(const Key('p03-tab-local-feed-activities')));
    await tester.pump();
    expect(selected, 2);
    expect(find.byKey(const Key('p03-local-sections')), findsOneWidget);
    expect(find.byKey(const Key('p03-local-section-local-feed')), findsOneWidget);
    await tester.tap(find.text('Activities'));
    await tester.pump();
    expect(find.byKey(const Key('p03-local-section-activities')), findsOneWidget);
    await tester.tap(find.byKey(const Key('p03-tab-connects')));
    await tester.pump();
    expect(selected, 3);
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pump();
    expect(selected, 4);
  });

  testWidgets('incomplete account shows Dating setup and Settings only',
      (tester) async {
    await tester.pumpWidget(MaterialApp(home: AccountNavigation(
      selectedIndex: 0, onSelect: null, onBack: _noop,
      home: const Text('Complete your account'),
      settings: const Text('Account security'),
    )));
    expect(find.byType(NavigationDestination), findsNWidgets(2));
    expect(find.text('Dating'), findsWidgets);
    expect(find.text('Home'), findsNothing);
    expect(find.byKey(const Key('p03-tab-local-feed-activities')), findsNothing);
    expect(find.byKey(const Key('p03-tab-friendship')), findsNothing);
  });
}
void _noop() {}
