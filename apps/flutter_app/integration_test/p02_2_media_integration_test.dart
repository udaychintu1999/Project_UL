// Real Android + Fastify + Java DynamoDB Local. Uses a disposable Android test app only.
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:uluv/features/auth/auth_service.dart';
import 'package:uluv/features/auth/persistent_session.dart';
import 'package:uluv/features/profiles/profile_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const base = String.fromEnvironment('ULUV_API_BASE_URL', defaultValue: 'http://127.0.0.1:3000');
  const dev = String.fromEnvironment('ULUV_DEV_TOKEN', defaultValue: '');
  const email = String.fromEnvironment('ULUV_P02_2_FIXTURE_EMAIL');
  const password = String.fromEnvironment('ULUV_P02_2_FIXTURE_PASSWORD');
  const uid = String.fromEnvironment('ULUV_P02_2_FIXTURE_UID');
  const isolated = bool.fromEnvironment('ULUV_P02_2_ISOLATED_ANDROID_TEST', defaultValue: false);
  final bytesA = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOskNvCQAgwEVQxqmgAFAEAUDIBYrTJMWAAAAAASUVORK5CYII=');
  final bytesB = base64Decode('iVBORw0KGgoAAAANSUhEUgAAABAAAAAOCAIAAACpTQvdAAAAGUlEQVR4nGOU21LBQApgIkn1qIZRDVTUAACZvQFmo22nxwAAAABJRU5ErkJggg==');

  testWidgets('P02-2 Android real media upload, mode reuse, authorized read and deletion', (tester) async {
    expect(isolated, isTrue);
    const channel = MethodChannel('uluv/p01_3_secure');
    final packageId = await tester.runAsync(() => channel.invokeMethod<String>('applicationId'));
    expect(packageId, 'com.example.uluv.p02isolated', reason: 'Never run media tests in the normal app.');
    expect(email, startsWith('p01-2-device-'));
    expect(uid, isNotEmpty);
    const vault = AndroidDeviceVault();
    if (await tester.runAsync(vault.read) != null) {
      fail('Disposable test app has an unexpected prior session. Reset only the isolated app.');
    }
    final login = await tester.runAsync(() => HttpAuthService(baseUrl: base, devToken: dev).passwordLogin(email, password));
    expect(login, isNotNull);
    expect(login!.ok, isTrue);
    expect(login.uniqueId, uid);
    final session = PersistentSessionController(vault: vault, api: const DeviceSessionApi(base));
    try {
      await tester.runAsync(() => session.enroll(login.token!, uid));
      final repo = HttpProfileRepository(baseUrl: base, access: session.access);
      final initial = await tester.runAsync(repo.dashboard);
      expect(initial!.ok, isTrue);
      final handle = 'media${uid.replaceAll('-', '').substring(0, 17)}';
      final claim = await tester.runAsync(() => repo.saveHandle(handle, initial.value!.identityRevision));
      expect(claim!.ok, isTrue);
      final setup = await tester.runAsync(() => repo.saveSetup(0,
        commonName: 'Media Test', locality: 'Hyderabad', gender: 'prefer_not_to_say',
        dating: true, friendship: false));
      expect(setup!.ok, isTrue);
      expect(setup.value!.onboarding.ready, isFalse);
      final firstDraft = await tester.runAsync(() => repo.saveDraft('dating', 0,
        displayName: 'Media Test', bio: 'Local development sample', interests: ['Art'], intention: 'Conversation'));
      expect(firstDraft!.ok, isTrue);
      final secondDraft = await tester.runAsync(() => repo.saveDraft('friendship', 0,
        displayName: 'Media Test', bio: 'Local development sample', interests: ['Music'], intention: 'Friendship'));
      expect(secondDraft!.ok, isTrue);
      final one = await tester.runAsync(() => repo.upload(bytesA));
      final two = await tester.runAsync(() => repo.upload(bytesB));
      expect(one!.ok, isTrue, reason: 'Actual bytes must upload and finalize.');
      expect(two!.ok, isTrue);
      final libraryOnly = await tester.runAsync(repo.dashboard);
      expect(libraryOnly!.value!.onboarding.ready, isFalse,
        reason: 'Library uploads do not count without mode assignment.');
      expect(libraryOnly.value!.onboarding.missing, contains('dating.photos'));
      final image = await tester.runAsync(() => repo.photoBytes(one.value!.mediaId));
      expect(image!.ok, isTrue);
      expect(image.value!.take(2).toList(), [255, 216], reason: 'Backend must return sanitized JPEG bytes.');
      final dating = await tester.runAsync(() => repo.assignPhotos('dating', 1, [one.value!.mediaId, two.value!.mediaId]));
      expect(dating!.ok, isTrue);
      expect(dating.value!.photoIds.length, 2);
      final datingReady = await tester.runAsync(repo.dashboard);
      expect(datingReady!.value!.onboarding.ready, isTrue);
      final bothSetup = await tester.runAsync(() => repo.saveSetup(1,
        commonName: 'Media Test', locality: 'Hyderabad', gender: 'prefer_not_to_say',
        dating: true, friendship: true));
      expect(bothSetup!.ok, isTrue);
      expect(bothSetup.value!.onboarding.ready, isFalse);
      expect(bothSetup.value!.onboarding.missing, contains('friendship.photos'));
      final friendship = await tester.runAsync(() => repo.assignPhotos('friendship', 1, [two.value!.mediaId]));
      expect(friendship!.ok, isTrue);
      final oneFriendPhoto = await tester.runAsync(repo.dashboard);
      expect(oneFriendPhoto!.value!.onboarding.ready, isFalse);
      final friendshipTwo = await tester.runAsync(() => repo.assignPhotos('friendship',
        friendship.value!.version, [two.value!.mediaId, one.value!.mediaId]));
      expect(friendshipTwo!.ok, isTrue);
      final readyBoth = await tester.runAsync(repo.dashboard);
      expect(readyBoth!.value!.onboarding.ready, isTrue);
      expect(readyBoth.value!.profiles['dating']!.photoIds.length, 2);
      expect(readyBoth.value!.profiles['friendship']!.photoIds.length, 2);
      final list = await tester.runAsync(repo.mediaLibrary);
      expect(list!.ok, isTrue);
      expect(list.value!.firstWhere((m) => m.mediaId == two.value!.mediaId).refCount, 2);
      final blocked = await tester.runAsync(() => repo.deletePhoto(two.value!.mediaId));
      expect(blocked!.ok, isFalse, reason: 'A referenced photo must never be deleted.');
      final removeDating = await tester.runAsync(() => repo.assignPhotos('dating', dating.value!.version, []));
      expect(removeDating!.ok, isTrue);
      final afterRemoval = await tester.runAsync(repo.dashboard);
      expect(afterRemoval!.value!.onboarding.ready, isFalse);
      expect(afterRemoval.value!.onboarding.missing, contains('dating.photos'));
      final removeFriendship = await tester.runAsync(() => repo.assignPhotos('friendship', friendshipTwo.value!.version, []));
      expect(removeFriendship!.ok, isTrue);
      expect((await tester.runAsync(() => repo.deletePhoto(two.value!.mediaId)))!.ok, isTrue);
      expect((await tester.runAsync(() => repo.deletePhoto(one.value!.mediaId)))!.ok, isTrue);
      final restored = await tester.runAsync(repo.dashboard);
      expect(restored!.ok, isTrue);
      expect(restored.value!.profiles['dating']!.photoIds, isEmpty);
      expect(restored.value!.profiles['dating']!.version, 3);
      expect(restored.value!.profiles['dating']!.missing, contains('photos'));
    } finally {
      await tester.runAsync(session.signOut);
    }
  });
}
