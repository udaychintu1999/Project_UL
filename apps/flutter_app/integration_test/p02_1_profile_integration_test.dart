// Physical Android: real Keystore session + real local API profile draft writes.
// Fixture credentials are synthetic, local-only and created by the Windows host runner.
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
  const email = String.fromEnvironment('ULUV_P02_1_FIXTURE_EMAIL', defaultValue: '');
  const password = String.fromEnvironment('ULUV_P02_1_FIXTURE_PASSWORD', defaultValue: '');
  const uid = String.fromEnvironment('ULUV_P02_1_FIXTURE_UID', defaultValue: '');
  const isolated = bool.fromEnvironment('ULUV_P02_1_ISOLATED_ANDROID_TEST', defaultValue: false);

  testWidgets('P02-1 Android authenticated handle and independent drafts persist after session restoration', (tester) async {
    expect(isolated, isTrue, reason: 'P02 tests must run under an isolated Android application ID.');
    // A Dart define alone cannot guarantee the installed app package. Verify
    // the actual Android package before touching any device credentials.
    const channel = MethodChannel('uluv/p01_3_secure');
    final packageId = await tester.runAsync(
      () => channel.invokeMethod<String>('applicationId'));
    expect(packageId, 'com.example.uluv.p02isolated',
      reason: 'P02 tests must never write to the normal installed U_luv app.');
    expect(email, startsWith('p01-2-device-'));
    expect(uid, isNotEmpty);
    const vault = AndroidDeviceVault();
    final existing = await tester.runAsync(() => vault.read());
    // Do not use expect(existing, isNull): Flutter would print the entire
    // sealed-session JSON, including the refresh credential, on failure.
    if (existing != null) {
      fail('Isolated P02 Android test app has pre-existing state. The runner must reset only its dedicated test package.');
    }
    final login = await tester.runAsync(() => HttpAuthService(baseUrl: base, devToken: dev).passwordLogin(email, password));
    expect(login, isNotNull);
    expect(login!.ok, isTrue);
    expect(login.uniqueId, uid);
    final session = PersistentSessionController(vault: vault, api: const DeviceSessionApi(base));
    var activeSession = session;
    try {
      await tester.runAsync(() => session.enroll(login.token!, uid));
      expect(session.stage, SessionStage.authenticated);
      final repo = HttpProfileRepository(baseUrl: base, access: session.access);
      final initial = await tester.runAsync(repo.dashboard);
      expect(initial, isNotNull);
      expect(initial!.ok, isTrue);
      expect(initial.value!.profiles['dating']!.version, 0);
      final handle = 'p02${uid.replaceAll('-', '').substring(0, 17)}';
      final claim = await tester.runAsync(() => repo.saveHandle(handle, initial.value!.identityRevision));
      expect(claim, isNotNull);
      expect(claim!.ok, isTrue);
      expect(claim.value, handle);
      final dating = await tester.runAsync(() => repo.saveDraft('dating', 0,
        displayName: 'Dating Name', bio: 'I enjoy books and music.',
        interests: ['Reading'], intention: 'Meaningful conversations'));
      expect(dating, isNotNull);
      expect(dating!.ok, isTrue);
      final friends = await tester.runAsync(() => repo.saveDraft('friendship', 0,
        displayName: 'Friendship Name', bio: 'I enjoy hiking and art.',
        interests: ['Art'], intention: 'Friendship'));
      expect(friends, isNotNull);
      expect(friends!.ok, isTrue);
      expect(dating.value!.version, 1);
      expect(friends.value!.version, 1);
      final beforeSetup = await tester.runAsync(repo.dashboard);
      expect(beforeSetup!.value!.onboarding.ready, isFalse);
      final setup = await tester.runAsync(() => repo.saveSetup(0,
        commonName: 'Common Name', locality: 'Hyderabad', gender: 'prefer_not_to_say',
        dating: true, friendship: false));
      expect(setup, isNotNull);
      expect(setup!.ok, isTrue);
      expect(setup.value!.onboarding.ready, isTrue);
      expect(setup.value!.profiles['dating']!.missing, contains('photos'));
      final relaunched = PersistentSessionController(vault: vault, api: const DeviceSessionApi(base));
      await tester.runAsync(relaunched.restore);
      activeSession = relaunched;
      expect(relaunched.stage, SessionStage.authenticated);
      final after = await tester.runAsync(() => HttpProfileRepository(baseUrl: base, access: relaunched.access).dashboard());
      expect(after, isNotNull);
      expect(after!.ok, isTrue);
      expect(after.value!.handle, handle);
      expect(after.value!.shared.commonName, 'Common Name');
      expect(after.value!.shared.dating, isTrue);
      expect(after.value!.shared.friendship, isFalse);
      expect(after.value!.onboarding.ready, isTrue);
      expect(after.value!.profiles['dating']!.displayName, 'Dating Name');
      expect(after.value!.profiles['friendship']!.displayName, 'Friendship Name');
      expect(after.value!.profiles['dating']!.missing, contains('photos'));
    } finally {
      await tester.runAsync(() => activeSession.signOut());
    }
  });
}
