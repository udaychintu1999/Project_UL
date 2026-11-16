import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/design/uluv_design.dart';
import 'package:uluv/features/auth/account_navigation.dart';
import 'package:uluv/features/profiles/profile_media.dart';
import 'package:uluv/features/profiles/profile_models.dart';
import 'package:uluv/features/profiles/profile_photos_panel.dart';

final Uint8List _samplePhoto = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOskNvCQAgwEVQxqmgAFAEAUDIBYrTJMWAAAAAASUVORK5CYII=');

class _PrivateMediaFixture implements ProfileMediaRepository {
  @override
  Future<ProfileResult<List<ProfileMedia>>> mediaLibrary() async =>
    const ProfileResult.success([ProfileMedia(mediaId: 'photo-1', refCount: 1)]);

  @override
  Future<ProfileResult<Uint8List>> photoBytes(String mediaId) async =>
    ProfileResult.success(_samplePhoto);

  @override
  Future<ProfileResult<ProfileMedia>> upload(Uint8List bytes) async =>
    const ProfileResult.failure('disabled_in_layout_test', 400);

  @override
  Future<ProfileResult<ProfileDraft>> assignPhotos(
    String mode, int expectedVersion, List<String> photoIds) async =>
    const ProfileResult.failure('disabled_in_layout_test', 400);

  @override
  Future<ProfileResult<bool>> deletePhoto(String mediaId) async =>
    const ProfileResult.failure('disabled_in_layout_test', 400);
}

void main() {
  test('P02-5 reference palettes keep accessible primary text contrast', () {
    final theme = UluvTheme.light();
    expect(theme.colorScheme.primary, UluvPalette.pinkAction);
    expect(theme.scaffoldBackgroundColor, UluvPalette.blush);

    double contrast(Color foreground) {
      final luminance = foreground.computeLuminance();
      return (1.05 / (luminance + 0.05));
    }
    expect(contrast(UluvPalette.pinkAction), greaterThanOrEqualTo(4.5));
    expect(contrast(UluvPalette.teal), greaterThanOrEqualTo(4.5));
    expect(contrast(UluvPalette.danger), greaterThanOrEqualTo(4.5));
  });

  testWidgets('reference surface and status are usable at 320dp', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(MaterialApp(theme: UluvTheme.light(),
      home: const Scaffold(body: SafeArea(child: SingleChildScrollView(
        child: Padding(padding: const EdgeInsets.all(12),
          child: Column(children: const [
            UluvStageBanner(title: 'Common profile',
              subtitle: 'Dating and Friendship both use these details.'),
            SizedBox(height: 12),
            UluvSectionCard(child: TextField(key: Key('p25-locality'),
              decoration: InputDecoration(labelText: 'City or locality'))),
            SizedBox(height: 12),
            UluvStatusNotice(message: 'Save required details.', warning: true),
          ])),
        ),
      ))));
    expect(find.text('Common profile'), findsOneWidget);
    expect(find.text('Save required details.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.enterText(find.byKey(const Key('p25-locality')), 'Hyderabad');
    await tester.pump();
    expect(find.text('Hyderabad'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('P02-5 shell preserves P02 Home/Settings and unsaved edits', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var selected = 0;
    await tester.pumpWidget(MaterialApp(theme: UluvTheme.light(),
      home: StatefulBuilder(builder: (context, update) => AccountNavigation(
        selectedIndex: selected,
        onSelect: (tab) => update(() => selected = tab),
        onBack: () => update(() => selected = 0),
        home: const TextField(key: Key('p25-private-draft')),
        settings: const Text('Secure device controls'),
      ))));
    await tester.enterText(find.byKey(const Key('p25-private-draft')), 'Unsent draft');
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pump();
    expect(find.text('Secure device controls'), findsOneWidget);
    await tester.tap(find.byKey(const Key('p02-tab-home')));
    await tester.pump();
    expect(find.text('Unsent draft'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('P02-5 colored mode cards use Material for real switch ink and taps',
      (tester) async {
    var dating = false;
    var friendship = false;
    await tester.pumpWidget(MaterialApp(theme: UluvTheme.light(),
      home: Scaffold(body: StatefulBuilder(builder: (context, update) =>
        Column(children: [
          UluvSectionCard(tint: UluvPalette.pinkTint, padding: EdgeInsets.zero,
            child: SwitchListTile(key: const Key('p25-dating-switch'),
              title: const Text('Enable Dating'), value: dating,
              onChanged: (next) => update(() => dating = next))),
          UluvSectionCard(tint: UluvPalette.tealTint, padding: EdgeInsets.zero,
            child: SwitchListTile(key: const Key('p25-friendship-switch'),
              title: const Text('Enable Friendship'), value: friendship,
              onChanged: (next) => update(() => friendship = next))),
        ])))));
    expect(tester.takeException(), isNull,
      reason: 'A colored DecoratedBox must never obscure ListTile ink.');
    await tester.tap(find.byKey(const Key('p25-dating-switch')));
    await tester.pumpAndSettle();
    expect(dating, isTrue);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byKey(const Key('p25-friendship-switch')));
    await tester.pumpAndSettle();
    expect(friendship, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('P02-5 mode-photo action rows fit at 320dp', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const profile = ProfileDraft(
      mode: 'dating', exists: true, version: 1, displayName: 'Person',
      bio: 'Hello', interests: ['Books'], intention: 'Meet people',
      missing: ['photos'], photoIds: ['photo-1']);
    await tester.pumpWidget(MaterialApp(theme: UluvTheme.light(),
      home: Scaffold(body: SafeArea(child: SingleChildScrollView(
        child: Padding(padding: const EdgeInsets.all(10),
          child: ProfilePhotosPanel(repository: _PrivateMediaFixture(),
            mode: 'dating', profile: profile, onUpdated: (_) {})),
      )))));
    await tester.pump();
    await tester.pump();
    expect(find.byKey(const Key('p02-photo-replace-0')), findsOneWidget);
    expect(find.byKey(const Key('p02-photo-remove-0')), findsOneWidget);
    expect(find.byKey(const Key('p02-pick-photo')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
