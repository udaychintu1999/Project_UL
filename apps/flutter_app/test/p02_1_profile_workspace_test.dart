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

Future<void> tapKey(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool canNext(WidgetTester tester) {
  final target = find.byKey(const Key('p02-next'));
  return target.evaluate().isNotEmpty &&
      tester.widget<FilledButton>(target).onPressed != null;
}

Future<void> saveCommon(WidgetTester tester, {
  bool dating = true, bool friendship = false, String name = 'Profile Name',
  String city = 'Hyderabad', String gender = 'Woman',
}) async {
  await tester.enterText(find.byKey(const Key('p02-handle')), 'person_handle');
  await tester.pumpAndSettle();
  await tapKey(tester, 'p02-save-handle');
  await tester.enterText(find.byKey(const Key('p02-common-name')), name);
  await tester.enterText(find.byKey(const Key('p02-locality')), city);
  await tapKey(tester, 'p02-gender');
  await tester.tap(find.text(gender).last);
  await tester.pumpAndSettle();
  if (dating) await tapKey(tester, 'p02-enable-dating');
  if (friendship) await tapKey(tester, 'p02-enable-friendship');
  await tapKey(tester, 'p02-save-common');
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
  await tapKey(tester, 'p02-save-draft');
}

Future<void> reusePhoto(WidgetTester tester, String id) async {
  await tapKey(tester, 'p02-reuse-$id');
}

void main() {
  testWidgets('guided onboarding cannot skip incomplete Common Profile', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    expect(find.textContaining('Step 1 of'), findsOneWidget);
    expect(find.byKey(const Key('p02-common-name')), findsOneWidget);
    expect(find.byKey(const Key('p02-bio')), findsNothing);
    expect(find.text('Saved account details'), findsNothing);
    expect(canNext(tester), isFalse);
    final warningFinder = find.byKey(const Key('p02-step-warning'));
    final warning = tester.widget<Text>(warningFinder);
    expect(warning.style?.fontWeight, FontWeight.w700);
    expect(warning.style?.color, Theme.of(tester.element(warningFinder)).colorScheme.error);
    await tester.drag(find.byKey(const Key('p02-swipe-region')),
      const Offset(-320, 0));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-common-name')), findsOneWidget,
      reason: 'Swipe forward cannot bypass unsaved Common Profile.');
    await tester.enterText(find.byKey(const Key('p02-common-name')), 'Incomplete');
    await tester.pumpAndSettle();
    expect(canNext(tester), isFalse,
      reason: 'Typing does not count as an authoritative save.');
  });

  testWidgets('Friendship-only journey is sequential, saved, and reviewable', (tester) async {
    final repo = PhotoReadyProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester, dating: false, friendship: true);
    expect(repo.shared.friendship, isTrue);
    expect(repo.shared.dating, isFalse);
    expect(canNext(tester), isTrue);
    await tapKey(tester, 'p02-next');
    expect(find.textContaining('Friendship details'), findsWidgets);
    expect(find.byKey(const Key('p02-bio')), findsOneWidget);
    expect(canNext(tester), isFalse);
    await saveMode(tester, intention: 'Friendship');
    expect(repo.profiles['friendship']!.version, 1);
    expect(canNext(tester), isTrue);
    await tapKey(tester, 'p02-next');
    expect(find.textContaining('Friendship photos'), findsWidgets);
    expect(canNext(tester), isFalse);
    await reusePhoto(tester, sampleOne);
    expect(repo.profiles['friendship']!.photoIds, [sampleOne]);
    expect(canNext(tester), isFalse);
    await reusePhoto(tester, sampleTwo);
    expect(canNext(tester), isTrue);
    await tapKey(tester, 'p02-next');
    expect(find.byKey(const Key('p02-page-review')), findsOneWidget);
    expect(find.text('City: Hyderabad'), findsOneWidget);
    expect(find.text('Gender: Woman'), findsOneWidget);
    expect(find.text('Enabled modes: Friendship'), findsOneWidget);
    expect(find.text('Photos: 2/6'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(repo.photoPreviewReads, greaterThanOrEqualTo(2),
      reason: 'Review must load saved photos through the media repository.');
    expect(find.byType(Image), findsNWidgets(2),
      reason: 'Both saved Friendship photos should render in final review.');
    expect(find.byKey(const Key('p02-continue')), findsOneWidget);
    await tapKey(tester, 'p02-continue');
    expect(find.byKey(const Key('p02-setup-ready')), findsOneWidget);
  });

  testWidgets('both enabled modes must finish in order, and removing a photo relocks Next', (tester) async {
    final repo = PhotoReadyProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester, dating: true, friendship: true);
    await tapKey(tester, 'p02-next');
    expect(find.textContaining('Dating details'), findsWidgets);
    await saveMode(tester);
    await tapKey(tester, 'p02-next');
    expect(find.textContaining('Dating photos'), findsWidgets);
    await reusePhoto(tester, sampleOne);
    await reusePhoto(tester, sampleTwo);
    await tapKey(tester, 'p02-next');
    expect(find.textContaining('Friendship details'), findsWidgets);
    expect(canNext(tester), isFalse);
    await saveMode(tester, intention: 'Friendship');
    await tapKey(tester, 'p02-next');
    expect(find.textContaining('Friendship photos'), findsWidgets);
    expect(canNext(tester), isFalse);
    await reusePhoto(tester, sampleOne);
    await reusePhoto(tester, sampleTwo);
    expect(canNext(tester), isTrue);
    await tapKey(tester, 'p02-photo-remove-0');
    expect(canNext(tester), isFalse,
      reason: 'The server-confirmed photo gate must close after a removal.');
    await reusePhoto(tester, sampleOne);
    expect(canNext(tester), isTrue);
    await tapKey(tester, 'p02-next');
    expect(find.text('Enabled modes: Dating and Friendship'), findsOneWidget);
    expect(find.text('Photos: 2/6'), findsNWidgets(2));
  });

  testWidgets('Back preserves unsaved mode fields and locks forward navigation', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester);
    await tapKey(tester, 'p02-next');
    await tester.enterText(find.byKey(const Key('p02-bio')),
      'Unsaved Dating Biography');
    await tester.pumpAndSettle();
    expect(canNext(tester), isFalse);
    await tapKey(tester, 'p02-back');
    expect(find.byKey(const Key('p02-locality')), findsOneWidget);
    expect(repo.profiles['dating']!.exists, isFalse);
    await tapKey(tester, 'p02-next');
    expect(tester.widget<TextField>(find.byKey(const Key('p02-bio'))).controller!.text,
      'Unsaved Dating Biography');
    expect(canNext(tester), isFalse);
  });

  testWidgets('handle conflict remains visible, red and requires a successful save', (tester) async {
    final repo = MemoryProfiles()..failNext = true;
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('p02-handle')), 'chosen123');
    await tester.pumpAndSettle();
    await tapKey(tester, 'p02-save-handle');
    expect(repo.handleSaves, 1);
    final message = tester.widget<Text>(find.byKey(const Key('p02-handle-error')));
    expect(message.data, contains('already in use'));
    expect(message.style?.fontWeight, FontWeight.w700);
    expect(canNext(tester), isFalse);
    await tapKey(tester, 'p02-save-handle');
    expect(repo.handle, 'chosen123');
  });

  testWidgets('reopening restores saved data, but never silently skips onboarding', (tester) async {
    final repo = PhotoReadyProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await saveCommon(tester);
    await tapKey(tester, 'p02-next');
    await saveMode(tester);
    await tapKey(tester, 'p02-next');
    await reusePhoto(tester, sampleOne);
    await reusePhoto(tester, sampleTwo);
    await tapKey(tester, 'p02-next');
    expect(find.byKey(const Key('p02-continue')), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    expect(find.textContaining('Step 1 of'), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const Key('p02-locality'))).controller!.text,
      'Hyderabad');
    expect(tester.widget<DropdownButton<String>>(find.byKey(const Key('p02-gender'))).value,
      'woman');
    expect(repo.profiles['dating']!.photoIds.length, 2);
    expect(canNext(tester), isTrue);
  });

  testWidgets('blank gender cannot unlock Next until saved', (tester) async {
    final repo = MemoryProfiles()..handle = 'owner_handle'
      ..shared = const SharedProfile(commonName: 'Shared', locality: 'Hyderabad',
        gender: '', dating: true, setupRevision: 1, age: 26);
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    expect(canNext(tester), isFalse);
    await tapKey(tester, 'p02-gender');
    await tester.tap(find.text('Prefer not to say').last);
    await tester.pumpAndSettle();
    expect(canNext(tester), isFalse);
    await tapKey(tester, 'p02-save-common');
    expect(repo.shared.gender, 'prefer_not_to_say');
    expect(canNext(tester), isTrue);
  });
  testWidgets('saving handle never overwrites unsaved shared details', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('p02-common-name')),
      'Unsaved Shared Name');
    await tester.enterText(find.byKey(const Key('p02-handle')),
      'new_owner_handle');
    await tester.pumpAndSettle();
    await tapKey(tester, 'p02-save-handle');
    expect(repo.handle, 'new_owner_handle');
    expect(repo.shared.commonName, isEmpty,
      reason: 'Account handle and Common Profile must be separate saves.');
    expect(tester.widget<TextField>(find.byKey(const Key('p02-common-name')))
      .controller!.text, 'Unsaved Shared Name');
    expect(tester.widget<FilledButton>(find.byKey(const Key('p02-save-common')))
      .onPressed, isNotNull);
    expect(canNext(tester), isFalse);
  });

  testWidgets('future step chips are locked; previous steps remain reachable', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.pumpAndSettle();
    final nextTab = find.byKey(const Key('p02-step-tab-1'));
    expect(tester.widget<ChoiceChip>(nextTab).onSelected, isNull);
    await saveCommon(tester);
    expect(tester.widget<ChoiceChip>(nextTab).onSelected, isNotNull);
    await tapKey(tester, 'p02-step-tab-1');
    expect(find.byKey(const Key('p02-bio')), findsOneWidget);
    expect(tester.widget<ChoiceChip>(find.byKey(const Key('p02-step-tab-0')))
      .onSelected, isNotNull);
    await tapKey(tester, 'p02-step-tab-0');
    expect(find.byKey(const Key('p02-common-name')), findsOneWidget);
  });

}
