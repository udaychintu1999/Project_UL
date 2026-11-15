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
  bool failNext = false;
  final profiles = <String, ProfileDraft>{
    'dating': draft('dating'), 'friendship': draft('friendship'),
  };

  @override
  Future<ProfileResult<ProfileDashboard>> dashboard() async =>
    ProfileResult.success(ProfileDashboard(handle: handle, identityRevision: revision,
      locality: null, profiles: Map.of(profiles)));

  @override
  Future<ProfileResult<String>> saveHandle(String next, int expected) async {
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
    await tester.ensureVisible(find.byKey(const Key('p02-save-handle')));
    await tester.tap(find.byKey(const Key('p02-save-handle')));
    await tester.pumpAndSettle();
    expect(find.textContaining('already in use'), findsOneWidget);
    await tester.tap(find.byKey(const Key('p02-save-handle')));
    await tester.pumpAndSettle();
    expect(repo.handle, 'chosen123');
    expect(repo.revision, 2);
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
