import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/profiles/profile_models.dart';
import 'package:uluv/features/profiles/profile_service.dart';
import 'package:uluv/features/profiles/profile_workspace.dart';

ProfileDraft draft(String mode, {int version = 0, String name = ''}) => ProfileDraft(
  mode: mode, exists: version > 0, version: version,
  displayName: name, bio: '', interests: const [], intention: '',
  missing: const ['handle', 'displayName', 'intention', 'photos', 'locality'],
);

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
    if (!shared.dating && !shared.friendship) missing.add('selectMode');
    for (final mode in ['dating', 'friendship']) {
      if (!(mode == 'dating' ? shared.dating : shared.friendship)) continue;
      final current = profiles[mode]!;
      if (!current.exists) { missing.add('$mode.draft'); continue; }
      if (current.bio.isEmpty) missing.add('$mode.bio');
      if (current.intention.isEmpty) missing.add('$mode.intention');
      if (current.interests.isEmpty) missing.add('$mode.interests');
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
      intention: intention.trim(), missing: const ['photos', 'locality']);
    profiles[mode] = saved;
    return ProfileResult.success(saved);
  }
}

Widget testApp(MemoryProfiles repo) => MaterialApp(
  home: Scaffold(body: SingleChildScrollView(
    child: Padding(padding: const EdgeInsets.all(12), child: ProfileWorkspace(repository: repo)),
  )),
);

void main() {
  testWidgets('P02-1 saves independent mode drafts and reloads versions', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(testApp(repo));
    await tester.tap(find.byKey(const Key('p02-open-profiles')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-save-draft')), findsOneWidget);
    await tester.enterText(find.byKey(const Key('p02-name')), 'Dating nickname');
    await tester.enterText(find.byKey(const Key('p02-intention')), 'Dating');
    await tester.ensureVisible(find.byKey(const Key('p02-save-draft')));
    await tester.tap(find.byKey(const Key('p02-save-draft')));
    await tester.pumpAndSettle();
    expect(repo.profiles['dating']!.version, 1);
    await tester.ensureVisible(find.byKey(const Key('p02-mode-friendship')));
    await tester.tap(find.byKey(const Key('p02-mode-friendship')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('p02-name')), 'Friendship nickname');
    await tester.ensureVisible(find.byKey(const Key('p02-save-draft')));
    await tester.tap(find.byKey(const Key('p02-save-draft')));
    await tester.pumpAndSettle();
    expect(repo.profiles['dating']!.displayName, 'Dating nickname');
    expect(repo.profiles['friendship']!.displayName, 'Friendship nickname');
    expect(repo.profiles['friendship']!.version, 1);
    await tester.pumpWidget(const SizedBox()); // dispose all transient editor state
    await tester.pumpWidget(testApp(repo)); // re-fetch persisted source
    await tester.tap(find.byKey(const Key('p02-open-profiles')));
    await tester.pumpAndSettle();
    expect(find.text('Draft version 1'), findsOneWidget);
  });

  testWidgets('P02 home opens the real draft form immediately, without a setup button', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(MaterialApp(home: Scaffold(
      body: SingleChildScrollView(
        child: ProfileWorkspace(repository: repo, initiallyExpanded: true),
      ),
    )));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-open-profiles')), findsNothing);
    expect(find.byKey(const Key('p02-name')), findsOneWidget);
    expect(find.byKey(const Key('p02-save-draft')), findsOneWidget);
  });

  testWidgets('P02-1 handle collision is surfaced; success retains canonical handle', (tester) async {
    final repo = MemoryProfiles()..failNext = true;
    await tester.pumpWidget(testApp(repo));
    await tester.tap(find.byKey(const Key('p02-open-profiles')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('p02-handle')), 'Chosen123');
    // TextField.onChanged schedules a frame: assert the rendered button after it.
    await tester.pumpAndSettle();
    final saveHandleButton = find.byKey(const Key('p02-save-handle'));
    await tester.ensureVisible(saveHandleButton);
    expect(tester.widget<OutlinedButton>(saveHandleButton).onPressed, isNotNull,
      reason: 'A typed handle must enable the Save handle action.');
    await tester.tap(saveHandleButton);
    await tester.pumpAndSettle();
    expect(repo.handleSaves, 1, reason: 'Handle save must reach the repository.');
    expect(find.byKey(const Key('p02-handle-error')), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const Key('p02-handle-error'))).data,
      contains('already in use'));
    await tester.tap(saveHandleButton);
    await tester.pumpAndSettle();
    expect(repo.handle, 'chosen123');
    expect(repo.revision, 2);
    expect(repo.handleSaves, 2);
    expect(find.byKey(const Key('p02-handle-error')), findsNothing);
  });

  testWidgets('P02-1 handle saving preserves unsaved common and mode fields', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(
      child: ProfileWorkspace(repository: repo, initiallyExpanded: true),
    ))));
    await tester.pumpAndSettle();
    final commonField = find.byKey(const Key('p02-common-name'));
    final bioField = find.byKey(const Key('p02-bio'));
    String textIn(Finder finder) => tester.widget<TextField>(finder).controller!.text;

    await tester.ensureVisible(commonField);
    await tester.enterText(commonField, 'Unsaved Common Name');
    await tester.pumpAndSettle();
    await tester.ensureVisible(bioField);
    await tester.enterText(bioField, 'Unsaved Dating Biography');
    await tester.pumpAndSettle();
    final handleField = find.byKey(const Key('p02-handle'));
    await tester.ensureVisible(handleField);
    await tester.enterText(handleField, 'AnotherHandle');
    await tester.pumpAndSettle();
    // First establish that the fields really received text. Reading the keyed
    // TextFields' controllers tests the form data even when a field is scrolled
    // out of the visible viewport or its editing surface is not matched by
    // the general find.text finder.
    expect(textIn(commonField), 'Unsaved Common Name');
    expect(textIn(bioField), 'Unsaved Dating Biography');
    final saveHandleButton = find.byKey(const Key('p02-save-handle'));
    await tester.ensureVisible(saveHandleButton);
    expect(tester.widget<OutlinedButton>(saveHandleButton).onPressed, isNotNull,
      reason: 'Account handle saving must not depend on unrelated unsaved fields.');
    await tester.tap(saveHandleButton);
    await tester.pumpAndSettle();
    expect(repo.handle, 'anotherhandle');
    expect(repo.handleSaves, 1);
    // The independent handle update may refresh server readiness, but must
    // preserve the *editable values*, not merely paint their labels.
    expect(textIn(commonField), 'Unsaved Common Name',
      reason: 'A handle-only save must not erase an unsaved common name.');
    expect(textIn(bioField), 'Unsaved Dating Biography',
      reason: 'A handle-only save must not erase an unsaved Dating bio.');
    expect(repo.shared.commonName, isEmpty,
      reason: 'Saving a handle must not implicitly persist the common form.');
    expect(repo.draftsSaved, 0,
      reason: 'Saving a handle must not implicitly persist the Dating draft.');
    expect(tester.widget<FilledButton>(find.byKey(const Key('p02-save-common'))).onPressed,
      isNotNull, reason: 'The unsaved common form must remain saveable.');
    expect(tester.widget<OutlinedButton>(saveHandleButton).onPressed, isNull,
      reason: 'Saved canonical handle must not offer a redundant write.');
  });

  testWidgets('P02-1 setup requires common info, selected mode and saved details', (tester) async {
    final repo = MemoryProfiles();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(
      child: ProfileWorkspace(repository: repo, initiallyExpanded: true),
    ))));
    await tester.pumpAndSettle();
    final continueButton = find.byKey(const Key('p02-continue'));
    expect(tester.widget<FilledButton>(continueButton).onPressed, isNull);
    await tester.enterText(find.byKey(const Key('p02-handle')), 'unique_handle');
    await tester.pumpAndSettle();
    final setupHandleButton = find.byKey(const Key('p02-save-handle'));
    await tester.ensureVisible(setupHandleButton);
    expect(tester.widget<OutlinedButton>(setupHandleButton).onPressed, isNotNull);
    await tester.tap(setupHandleButton);
    await tester.pumpAndSettle();
    expect(repo.handle, 'unique_handle', reason: 'Saving the handle is a prerequisite to onboarding.');
    await tester.enterText(find.byKey(const Key('p02-common-name')), 'Common Name');
    await tester.enterText(find.byKey(const Key('p02-locality')), 'Hyderabad');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('p02-enable-dating')));
    await tester.tap(find.byKey(const Key('p02-enable-dating')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('p02-save-common')));
    await tester.tap(find.byKey(const Key('p02-save-common')));
    await tester.pumpAndSettle();
    expect(repo.shared.dating, isTrue);
    expect(repo.shared.friendship, isFalse);
    expect(repo.shared.commonName, 'Common Name');
    expect(repo.shared.locality, 'Hyderabad');
    expect(tester.widget<FilledButton>(continueButton).onPressed, isNull);
    await tester.enterText(find.byKey(const Key('p02-bio')), 'I enjoy books and arts.');
    await tester.enterText(find.byKey(const Key('p02-intention')), 'Meaningful relationship');
    await tester.enterText(find.byKey(const Key('p02-interests')), 'Reading, Art');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('p02-save-draft')));
    await tester.tap(find.byKey(const Key('p02-save-draft')));
    await tester.pumpAndSettle();
    expect(repo.draftsSaved, 1, reason: 'Mode draft must actually be persisted.');
    await tester.ensureVisible(continueButton);
    final saved = await repo.dashboard();
    expect(saved.value!.onboarding.ready, isTrue,
      reason: 'The fixture must report complete saved setup after the draft write.');
    // The button may only unlock after the authenticated post-save refresh;
    // a transient unsaved form must not bypass that server-derived result.
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(continueButton).onPressed, isNotNull,
      reason: 'Saved setup is complete, and the post-save refresh must unlock Continue.');
    await tester.tap(continueButton);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-setup-ready')), findsOneWidget);
  });

  testWidgets('P02-1 incomplete second enabled mode blocks continuation after restart', (tester) async {
    final repo = MemoryProfiles()
      ..handle = 'testhandle'
      ..shared = const SharedProfile(commonName: 'Shared', locality: 'Hyderabad',
        dating: true, friendship: true, setupRevision: 1, age: 26);
    repo.profiles['dating'] = const ProfileDraft(mode: 'dating', exists: true, version: 1,
      displayName: '', bio: 'Reading and hiking', interests: ['Reading'],
      intention: 'A relationship', missing: ['photos']);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(
      child: ProfileWorkspace(repository: repo, initiallyExpanded: true),
    ))));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-setup-ready')), findsNothing);
    expect(tester.widget<FilledButton>(find.byKey(const Key('p02-continue'))).onPressed, isNull);
    expect(find.textContaining('Save your Friendship details'), findsOneWidget);
  });

  testWidgets('P02-1 conflict keeps typed unsaved data for review', (tester) async {
    final repo = MemoryProfiles()..failNext = true;
    await tester.pumpWidget(testApp(repo));
    await tester.tap(find.byKey(const Key('p02-open-profiles')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('p02-name')), 'Unsaved edits');
    await tester.ensureVisible(find.byKey(const Key('p02-save-draft')));
    await tester.tap(find.byKey(const Key('p02-save-draft')));
    await tester.pumpAndSettle();
    expect(find.textContaining('Another edit was saved first'), findsOneWidget);
    expect(find.text('Unsaved edits'), findsOneWidget);
    expect(repo.draftsSaved, 0);
  });
}
