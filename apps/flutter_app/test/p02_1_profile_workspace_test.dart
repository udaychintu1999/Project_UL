import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/profiles/profile_media.dart';
import 'package:uluv/features/profiles/profile_models.dart';
import 'package:uluv/features/profiles/profile_service.dart';
import 'package:uluv/features/profiles/profile_workspace.dart';

ProfileDraft draft(String mode, {int version = 0, String name = ''}) => ProfileDraft(
  mode: mode, exists: version > 0, version: version,
  displayName: name, bio: '', interests: const [], intention: '',
  missing: const ['handle', 'displayName', 'intention', 'photos', 'locality'],
);

const sampleOne = '11111111-1111-4111-8111-111111111111';
const sampleTwo = '22222222-2222-4222-8222-222222222222';

class MemoryProfiles implements ProfileRepository {
  String? handle;
  int revision = 1;
  int draftsSaved = 0;
  int handleSaves = 0;
  bool failNext = false;
  SharedProfile shared = const SharedProfile();
  final profiles = <String, ProfileDraft>{
    'dating': draft('dating'), 'friendship': draft('friendship'),
  };

  @override
  Future<ProfileResult<ProfileDashboard>> dashboard() async {
    final missing = <String>[];
    if (handle == null) missing.add('handle');
    if (shared.commonName.isEmpty) missing.add('commonName');
    if (shared.locality.isEmpty) missing.add('locality');
    if (shared.gender.isEmpty) missing.add('gender');
    if (!shared.dating && !shared.friendship) missing.add('selectMode');
    for (final mode in ['dating', 'friendship']) {
      if (!(mode == 'dating' ? shared.dating : shared.friendship)) continue;
      final current = profiles[mode]!;
      if (!current.exists) { missing.add('$mode.draft'); continue; }
      if (current.bio.isEmpty) missing.add('$mode.bio');
      if (current.intention.isEmpty) missing.add('$mode.intention');
      if (current.interests.isEmpty) missing.add('$mode.interests');
      if (current.photoIds.toSet().length < 2) missing.add('$mode.photos');
    }
    return ProfileResult.success(ProfileDashboard(handle: handle, identityRevision: revision,
      locality: shared.locality, profiles: Map.of(profiles), shared: shared,
      onboarding: OnboardingStatus(ready: missing.isEmpty, missing: missing)));
  }

  @override
  Future<ProfileResult<ProfileDashboard>> saveSetup(int expected, {
    required String commonName, required String locality, required String gender,
    required bool dating, required bool friendship,
  }) async {
    if (expected != shared.setupRevision) {
      return const ProfileResult.failure('setup_revision_conflict', 409);
    }
    shared = SharedProfile(commonName: commonName, locality: locality, gender: gender,
      age: 26, dating: dating, friendship: friendship, setupRevision: expected + 1);
    return dashboard();
  }

  @override
  Future<ProfileResult<String>> saveHandle(String next, int expected) async {
    handleSaves++;
    if (failNext) { failNext = false; return const ProfileResult.failure('handle_taken', 409); }
    if (expected != revision) return const ProfileResult.failure('identity_revision_conflict', 409);
    handle = next.toLowerCase(); revision++;
    return ProfileResult.success(handle!);
  }

  @override
  Future<ProfileResult<ProfileDashboard>> setModeActivation(String mode, int version, bool active) async {
    final before = profiles[mode]!;
    if (before.version != version) return const ProfileResult.failure('profile_version_conflict', 409);
    profiles[mode] = ProfileDraft(mode: mode, exists: true, version: version + 1,
      displayName: before.displayName, bio: before.bio, interests: before.interests,
      intention: before.intention, missing: before.missing, photoIds: before.photoIds,
      requestedActive: active,
      visibility: active ? 'pending_trusted_locality' : 'inactive');
    return dashboard();
  }

  @override
  Future<ProfileResult<Map<String, dynamic>>> ownerPreview(String mode) async =>
    ProfileResult.success({ 'displayName': shared.commonName, 'broadArea': shared.locality,
      'age': shared.age, 'intention': profiles[mode]!.intention,
      'bio': profiles[mode]!.bio, 'interests': profiles[mode]!.interests.take(3).toList(),
      'photoIds': profiles[mode]!.photoIds.take(2).toList(),
      'publicVisible': false });

  @override
  Future<ProfileResult<ProfileDraft>> saveDraft(String mode, int version,
      {required String displayName, required String bio,
       required List<String> interests, required String intention}) async {
    if (failNext) { failNext = false; return const ProfileResult.failure('profile_version_conflict', 409); }
    if (version != profiles[mode]!.version) return const ProfileResult.failure('profile_version_conflict', 409);
    draftsSaved++;
    final saved = ProfileDraft(mode: mode, exists: true, version: version + 1,
      displayName: displayName.trim(), bio: bio.trim(), interests: interests,
      intention: intention.trim(), missing: const ['photos', 'locality'],
      photoIds: profiles[mode]!.photoIds);
    profiles[mode] = saved;
    return ProfileResult.success(saved);
  }
}


/// Test fixture mirrors the real API's authoritative post-assignment dashboard.
/// A photo is only counted when its mode photoIds are persisted in this store.
class PhotoReadyProfiles extends MemoryProfiles implements ProfileMediaRepository {
  final library = <ProfileMedia>[
    const ProfileMedia(mediaId: sampleOne, refCount: 0),
    const ProfileMedia(mediaId: sampleTwo, refCount: 0),
  ];
  int photoPreviewReads = 0;

  @override
  Future<ProfileResult<List<ProfileMedia>>> mediaLibrary() async =>
    ProfileResult.success(library.map((photo) => ProfileMedia(
      mediaId: photo.mediaId,
      refCount: profiles.values.where((mode) => mode.photoIds.contains(photo.mediaId)).length,
    )).toList());

  @override
  Future<ProfileResult<Uint8List>> photoBytes(String id) async {
    photoPreviewReads++;
    // A complete PNG (not just a file signature) proves Image.memory receives
    // valid bytes through the media repository used by the final review.
    return ProfileResult.success(base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOskNvCQAgwEVQxqmgAFAEAUDIBYrTJMWAAAAAASUVORK5CYII='));
  }

  @override
  Future<ProfileResult<ProfileMedia>> upload(Uint8List bytes) async =>
    const ProfileResult<ProfileMedia>.failure('not_used_in_this_test', 400);

  @override
  Future<ProfileResult<ProfileDraft>> assignPhotos(String mode, int expectedVersion, List<String> ids) async {
    final previous = profiles[mode]!;
    if (previous.version != expectedVersion || ids.length > 6 ||
        ids.toSet().length != ids.length || ids.any((id) => !library.any((m) => m.mediaId == id))) {
      return const ProfileResult.failure('photo_assignment_conflict', 409);
    }
    final next = ProfileDraft(mode: mode, exists: true, version: expectedVersion + 1,
      displayName: previous.displayName, bio: previous.bio,
      interests: previous.interests, intention: previous.intention,
      missing: ids.length < 2 ? const ['photos'] : const [], photoIds: List.of(ids));
    profiles[mode] = next;
    return ProfileResult.success(next);
  }

  @override
  Future<ProfileResult<bool>> deletePhoto(String id) async =>
    const ProfileResult<bool>.failure('media_in_use', 409);
}


Widget testApp(MemoryProfiles repo) => MaterialApp(home: Scaffold(
  body: SingleChildScrollView(child: Padding(
    padding: const EdgeInsets.all(12),
    child: ProfileWorkspace(repository: repo, initiallyExpanded: true),
  )),
));

/// Real, viewport-safe widget taps. The default ensureVisible alignment can
/// leave a long-form control at the very top of a clipped/overlaid scrollable.
/// Explicitly center it in every enclosing scrollable, WITHOUT awaiting a
/// nonzero-duration animation (test frames would not advance and could hang).
Future<void> tapKey(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  expect(finder, findsOneWidget, reason: 'Required UI control $key must exist.');
  await Scrollable.ensureVisible(
    tester.element(finder),
    alignment: 0.5,
    duration: Duration.zero,
    alignmentPolicy: ScrollPositionAlignmentPolicy.explicit,
  );
  await tester.pump();
  final rect = tester.getRect(finder);
  final viewHeight = tester.view.physicalSize.height / tester.view.devicePixelRatio;
  expect(rect.top, greaterThanOrEqualTo(0),
    reason: 'UI control $key must not be clipped above the viewport.');
  expect(rect.bottom, lessThanOrEqualTo(viewHeight),
    reason: 'UI control $key must not be clipped below the viewport.');
  // A missed tap is a real test failure, never a warning followed by false PASS.
  final previousPolicy = WidgetController.hitTestWarningShouldBeFatal;
  WidgetController.hitTestWarningShouldBeFatal = true;
  try {
    await tester.tap(finder);
  } finally {
    WidgetController.hitTestWarningShouldBeFatal = previousPolicy;
  }
  await tester.pumpAndSettle();
}

/// A missed dropdown tap previously produced a misleading `.last` StateError.
/// Require the native Flutter dropdown to OPEN and verify its saved selection.
Future<void> chooseGender(WidgetTester tester, String label) async {
  const values = <String, String>{
    'Woman': 'woman',
    'Man': 'man',
    'Non-binary': 'non_binary',
    'Another identity': 'another_identity',
    'Prefer not to say': 'prefer_not_to_say',
  };
  final expected = values[label];
  expect(expected, isNotNull, reason: 'Test must use an approved gender option.');
  await tapKey(tester, 'p02-gender');
  final choice = find.text(label);
  expect(choice, findsWidgets,
    reason: 'Gender dropdown did not open. Check real pointer hit and viewport positioning.');
  final previousPolicy = WidgetController.hitTestWarningShouldBeFatal;
  WidgetController.hitTestWarningShouldBeFatal = true;
  try {
    await tester.tap(choice.last);
  } finally {
    WidgetController.hitTestWarningShouldBeFatal = previousPolicy;
  }
  await tester.pumpAndSettle();
  expect(tester.widget<DropdownButton<String>>(
      find.byKey(const Key('p02-gender'))).value, expected,
    reason: 'Gender selection must update the actual profile form.');
}

bool canAdvance(WidgetTester tester) =>
  find.text('Saved and verified. You can continue.').evaluate().isNotEmpty;

Future<void> saveCommon(WidgetTester tester, {
  bool dating = true, bool friendship = false, String name = 'Profile Name',
  String city = 'Hyderabad', String gender = 'Woman',
}) async {
  await tester.enterText(find.byKey(const Key('p02-handle')), 'person_handle');
  await tester.enterText(find.byKey(const Key('p02-common-name')), name);
  await tester.enterText(find.byKey(const Key('p02-locality')), city);
  await chooseGender(tester, gender);
  if (dating) await tapKey(tester, 'p02-enable-dating');
  if (friendship) await tapKey(tester, 'p02-enable-friendship');
  await tapKey(tester, 'p02-save-next');
  expect(find.byKey(const Key('p02-bio')), findsOneWidget,
    reason: 'Save & Next must persist Common Profile before advancing.');
}

Future<void> saveMode(WidgetTester tester, {
  String bio = 'I like thoughtful conversation and art',
  String intention = 'Conversation',
  String interests = 'Art, Books',
}) async {
  await tester.enterText(find.byKey(const Key('p02-bio')), bio);
  await tester.enterText(find.byKey(const Key('p02-intention')), intention);
  await tester.enterText(find.byKey(const Key('p02-interests')), interests);
  await tester.pumpAndSettle();
  await tapKey(tester, 'p02-save-next');
  expect(find.byKey(const Key('p02-pick-photo')), findsOneWidget);
}

Future<void> reusePhoto(WidgetTester tester, String id) async {
  await tapKey(tester, 'p02-reuse-$id');
}

void main() {
  testWidgets('Save & Next is the only forward action; incomplete Common Profile is blocked', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-save-next')), findsOneWidget);
    expect(find.byKey(const Key('p02-next')), findsNothing);
    expect(find.byKey(const Key('p02-save-handle')), findsNothing);
    expect(find.byKey(const Key('p02-save-common')), findsNothing);
    expect(find.byKey(const Key('p02-save-draft')), findsNothing);
    final warning = tester.widget<Text>(find.byKey(const Key('p02-step-warning')));
    expect(warning.style?.fontWeight, FontWeight.w700);
    await tapKey(tester, 'p02-save-next');
    expect(find.byKey(const Key('p02-common-name')), findsOneWidget);
    expect(repo.handle, isNull);
    await tester.drag(find.byKey(const Key('p02-swipe-region')), const Offset(-320, 0));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-common-name')), findsOneWidget);
  });

  testWidgets('Friendship-only setup uses server saves, photos, final review and private activation', (tester) async {
    final repo = PhotoReadyProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester, dating: false, friendship: true);
    expect(repo.shared.friendship, isTrue);
    expect(repo.shared.dating, isFalse);
    await saveMode(tester, intention: 'Friendship');
    await reusePhoto(tester, sampleOne);
    expect(canAdvance(tester), isFalse);
    await reusePhoto(tester, sampleTwo);
    expect(canAdvance(tester), isTrue);
    await tapKey(tester, 'p02-save-next');
    expect(find.byKey(const Key('p02-page-review')), findsOneWidget);
    expect(find.text('City: Hyderabad'), findsOneWidget);
    expect(find.text('Photos: 2/6'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(repo.photoPreviewReads, greaterThanOrEqualTo(2));
    expect(find.byType(Image), findsNWidgets(2));
    await tapKey(tester, 'p02-continue');
    expect(find.byKey(const Key('p02-setup-ready')), findsOneWidget);
    await tapKey(tester, 'p02-activate-friendship');
    expect(repo.profiles['friendship']!.requestedActive, isTrue);
    expect(repo.profiles['dating']!.requestedActive, isFalse);
    expect(find.textContaining('pending_trusted_locality'), findsWidgets);
    expect(find.textContaining('Remains private'), findsWidgets);
    await tapKey(tester, 'p02-owner-preview-friendship');
    expect(find.text('Private Friendship preview'), findsOneWidget);
    expect(find.byKey(const Key('p02-private-preview-photos')), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.byType(Image), findsNWidgets(2),
      reason: 'The private safe projection must render two real owner photos.');
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    await tapKey(tester, 'p02-activate-friendship');
    expect(repo.profiles['friendship']!.requestedActive, isFalse,
      reason: 'An explicit deactivation must leave the mode private.');
  });

  testWidgets('both modes require independently saved text and two photos', (tester) async {
    final repo = PhotoReadyProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester, dating: true, friendship: true);
    await saveMode(tester);
    await reusePhoto(tester, sampleOne);
    await reusePhoto(tester, sampleTwo);
    await tapKey(tester, 'p02-save-next');
    expect(find.byKey(const Key('p02-bio')), findsOneWidget);
    await saveMode(tester, intention: 'Friendship');
    await reusePhoto(tester, sampleOne);
    await reusePhoto(tester, sampleTwo);
    expect(canAdvance(tester), isTrue);
    await tapKey(tester, 'p02-photo-remove-0');
    expect(canAdvance(tester), isFalse);
    await reusePhoto(tester, sampleOne);
    expect(canAdvance(tester), isTrue);
    await tapKey(tester, 'p02-save-next');
    expect(find.text('Enabled modes: Dating and Friendship'), findsOneWidget);
    expect(find.text('Photos: 2/6'), findsNWidgets(2));
  });

  testWidgets('Back preserves unsaved mode fields without writing a draft', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester);
    await tester.enterText(find.byKey(const Key('p02-bio')), 'Unsaved Dating Biography');
    await tester.pumpAndSettle();
    await tapKey(tester, 'p02-back');
    expect(repo.profiles['dating']!.exists, isFalse);
    await tapKey(tester, 'p02-step-tab-1');
    expect(tester.widget<TextField>(find.byKey(const Key('p02-bio'))).controller!.text,
      'Unsaved Dating Biography');
  });

  testWidgets('handle collision blocks combined Save & Next without faking a save', (tester) async {
    final repo = MemoryProfiles()..failNext = true;
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('p02-handle')), 'person_handle');
    await tester.enterText(find.byKey(const Key('p02-common-name')), 'Alex');
    await tester.enterText(find.byKey(const Key('p02-locality')), 'Hyderabad');
    await chooseGender(tester, 'Woman');
    await tapKey(tester, 'p02-enable-dating');
    await tapKey(tester, 'p02-save-next');
    expect(repo.handleSaves, 1);
    expect(repo.shared.setupRevision, 0);
    expect(find.byKey(const Key('p02-common-name')), findsOneWidget);
    final error = tester.widget<Text>(find.byKey(const Key('p02-handle-error')));
    expect(error.data, contains('already in use'));
    expect(error.style?.fontWeight, FontWeight.w700);
    await tapKey(tester, 'p02-save-next');
    expect(repo.handle, 'person_handle');
    expect(repo.shared.setupRevision, 1);
    expect(find.byKey(const Key('p02-bio')), findsOneWidget);
  });

  testWidgets('reopening restores saved common fields without skipping setup', (tester) async {
    final repo = PhotoReadyProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester);
    await saveMode(tester);
    await reusePhoto(tester, sampleOne);
    await reusePhoto(tester, sampleTwo);
    await tapKey(tester, 'p02-save-next');
    expect(find.byKey(const Key('p02-page-review')), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    expect(find.textContaining('Step 1 of'), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const Key('p02-locality'))).controller!.text, 'Hyderabad');
    expect(tester.widget<DropdownButton<String>>(find.byKey(const Key('p02-gender'))).value, 'woman');
    expect(repo.profiles['dating']!.photoIds, hasLength(2));
  });
}
