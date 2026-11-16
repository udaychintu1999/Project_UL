import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/profiles/profile_media.dart';
import 'package:uluv/features/profiles/profile_models.dart';
import 'package:uluv/features/profiles/profile_photos_panel.dart';

final sample = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOskNvCQAgwEVQxqmgAFAEAUDIBYrTJMWAAAAAASUVORK5CYII=');
ProfileDraft draft(int version, List<String> photos) => ProfileDraft(mode: 'dating', exists: true, version: version,
  displayName: 'Person', bio: 'Hello', interests: const ['Art'], intention: 'Friendship',
  missing: photos.length < 2 ? const ['photos'] : const [], photoIds: photos);

class FakeMedia implements ProfileMediaRepository {
  List<ProfileMedia> media = [];
  ProfileDraft current = draft(1, []);
  bool uploadShouldFail = false;
  int uploads = 0;
  @override
  Future<ProfileResult<List<ProfileMedia>>> mediaLibrary() async => ProfileResult.success(List.of(media));
  @override
  Future<ProfileResult<Uint8List>> photoBytes(String id) async => ProfileResult.success(sample);
  @override
  Future<ProfileResult<ProfileMedia>> upload(Uint8List bytes) async {
    uploads++;
    if (uploadShouldFail) return const ProfileResult.failure('invalid_image', 415);
    const m = ProfileMedia(mediaId: '11111111-1111-4111-8111-111111111111', refCount: 0);
    media = [m, ...media];
    return const ProfileResult<ProfileMedia>.success(m);
  }
  @override
  Future<ProfileResult<ProfileDraft>> assignPhotos(String mode, int expectedVersion, List<String> ids) async {
    if (expectedVersion != current.version || ids.length > 6 || ids.toSet().length != ids.length) {
      return const ProfileResult.failure('photo_assignment_conflict', 409);
    }
    current = draft(current.version + 1, ids);
    media = media.map((m) => ProfileMedia(mediaId: m.mediaId,
      refCount: ids.contains(m.mediaId) ? 1 : 0)).toList();
    return ProfileResult.success(current);
  }
  @override
  Future<ProfileResult<bool>> deletePhoto(String id) async {
    if (media.any((m) => m.mediaId == id && m.refCount > 0)) {
      return const ProfileResult.failure('media_in_use', 409);
    }
    media.removeWhere((m) => m.mediaId == id);
    return const ProfileResult.success(true);
  }
}

void main() {
  testWidgets('P02-2 picker preview → upload → private mode assignment', (tester) async {
    final repo = FakeMedia();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(
      child: StatefulBuilder(builder: (context, setState) => ProfilePhotosPanel(
        repository: repo, mode: 'dating', profile: repo.current,
        pickPhoto: () async => sample,
        onUpdated: (_) => setState(() {}),
      )),
    ))));
    await tester.pumpAndSettle();
    expect(tester.widget<Text>(find.byKey(const Key('p02-photo-count'))).data, '0 / 6');
    await tester.tap(find.byKey(const Key('p02-pick-photo')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-confirm-photo-upload')), findsOneWidget);
    await tester.tap(find.byKey(const Key('p02-confirm-photo-upload')));
    await tester.pumpAndSettle();
    expect(repo.uploads, 1);
    expect(repo.current.photoIds.length, 1);
    expect(tester.widget<Text>(find.byKey(const Key('p02-photo-count'))).data, '1 / 6');
    expect(repo.current.version, 2);
    await tester.ensureVisible(find.byKey(const Key('p02-photo-remove-0')));
    await tester.tap(find.byKey(const Key('p02-photo-remove-0')));
    await tester.pumpAndSettle();
    expect(repo.current.photoIds, isEmpty);
    expect(repo.media.first.refCount, 0);
  });

  testWidgets('P02-2 invalid upload retains preview for retry; cancel has no mutations', (tester) async {
    final repo = FakeMedia()..uploadShouldFail = true;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: SingleChildScrollView(
      child: ProfilePhotosPanel(repository: repo, mode: 'dating', profile: repo.current,
        pickPhoto: () async => sample, onUpdated: (_) {}),
    ))));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('p02-pick-photo')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('p02-confirm-photo-upload')));
    await tester.pumpAndSettle();
    expect(repo.uploads, 1);
    expect(repo.current.photoIds, isEmpty);
    expect(find.byKey(const Key('p02-confirm-photo-upload')), findsOneWidget,
      reason: 'Failed upload keeps the selected photo so it can be retried.');
    await tester.tap(find.byKey(const Key('p02-cancel-photo-upload')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-confirm-photo-upload')), findsNothing);
    expect(repo.current.photoIds, isEmpty);
  });
}
