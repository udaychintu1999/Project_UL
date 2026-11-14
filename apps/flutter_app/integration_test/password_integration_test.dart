// Real Android P01-2 UI journey. A synthetic password-enabled account is
// provisioned via the real local Fastify/DynamoDB API on the HOST before the
// Flutter test starts, so this test is independent of the known P01-1 OTP
// Android-runner HTTP issue. No mock auth responses are used here.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:uluv/diagnostics_service.dart';
import 'package:uluv/features/auth/auth_service.dart';
import 'package:uluv/main.dart';

import 'auth_test_observer.dart';

String currentStatus(WidgetTester tester) {
  final finder = find.byKey(const Key('auth-message'));
  if (finder.evaluate().isEmpty) return '<status widget unavailable>';
  final widget = tester.widget<Text>(finder);
  return widget.data ?? widget.textSpan?.toPlainText() ?? '<empty status>';
}

Future<void> tapAuth(
  WidgetTester tester,
  ObservedPasswordAuthService observer,
  AuthOperation action,
  Key button,
  String expectedStatus, {
  bool shouldSucceed = true,
}) async {
  final target = find.byKey(button);
  // Keyboard/route overlays can intercept taps on the small phone viewport.
  // Dismiss them before locating the actual visible control; never suppress
  // hit-test warnings or claim a request happened if the button was missed.
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
  await tester.ensureVisible(target);
  await tester.pumpAndSettle();
  if (action == AuthOperation.passwordLogin) {
    final before = observer.expectedLoginFieldMatches(
      tester.widget<TextField>(find.byKey(const Key('auth-email'))).controller?.text ?? '',
      tester.widget<TextField>(find.byKey(const Key('auth-password'))).controller?.text ?? '',
    );
    if (before == null || !before.email || !before.password) {
      throw TestFailure('P01-2 login input changed BEFORE button tap '
          '(email match: ${before?.email}, password match: ${before?.password}). '
          'No credentials logged.');
    }
  }
  observer.clear(action);
  await tester.tap(target);
  await tester.pump();
  final pending = observer.pending(action);
  if (pending == null) {
    throw TestFailure('P01-2 ${action.name}: UI did not trigger a request. Status: ${currentStatus(tester)}');
  }
  if (action == AuthOperation.passwordLogin && observer.lastLoginInputsMatch == false) {
    throw TestFailure('P01-2 login input changed DURING button tap '
        '(email match: ${observer.lastLoginEmailMatch}, '
        'password match: ${observer.lastLoginPasswordMatch}). '
        'No credentials logged.');
  }
  if (action == AuthOperation.passwordChange && observer.lastChangeInputsMatch == false) {
    throw TestFailure('P01-2 password-change UI submitted unexpected current/new values. No credentials logged.');
  }
  // Run the actual HTTP operation in Flutter's real async test zone, exactly
  // once. Never repeat a password/recovery write after an uncertain outcome.
  final result = await tester.runAsync(
    () => pending.execute().timeout(const Duration(seconds: 35)),
  );
  if (result == null) throw TestFailure('P01-2 ${action.name}: request did not finish.');
  await tester.pumpAndSettle();
  final visible = currentStatus(tester);
  if (result.ok != shouldSucceed || !visible.startsWith(expectedStatus)) {
    throw TestFailure('P01-2 ${action.name}: ${result.message}; UI status: $visible');
  }
}

// After the device changes its password, verify the newly stored credential
// directly through the same real Android HttpAuthService. This separates a
// backend/update failure from a subsequent Flutter text-entry/UI failure.
// The probe uses a new real server session and revokes it immediately.
Future<void> verifyChangedPasswordAtAPI(
  WidgetTester tester,
  HttpAuthService api,
  String email,
  String nextPassword,
  String uid,
) async {
  final result = await tester.runAsync(() async {
    final signedIn = await api.passwordLogin(email, nextPassword)
        .timeout(const Duration(seconds: 35));
    if (signedIn.ok && signedIn.token != null) {
      final logout = await api.logout(signedIn.token!)
          .timeout(const Duration(seconds: 35));
      if (!logout.ok) return const AuthResult(
          ok: false, message: 'Changed-password API probe could not revoke its temporary session.');
    }
    return signedIn;
  });
  if (result == null || !result.ok || result.uniqueId != uid) {
    throw TestFailure('P01-2 new-password API probe failed after a reported successful change: '
        '${result?.message ?? 'No response'}. This is not a UI input assertion.');
  }
  await tester.pump();
}

Future<void> enter(WidgetTester tester, Key key, String value) async {
  final target = find.byKey(key);
  await tester.ensureVisible(target);
  // Physical Android reuses an IME text-input connection across attempts.
  // Release and re-establish focus before replacing the field value. The
  // ordinary tester.enterText() API still drives the real Flutter TextField.
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump();
  await tester.tap(target);
  await tester.pump();
  await tester.enterText(target, value);
  await tester.pump();
  final field = tester.widget<TextField>(target);
  if (field.controller?.text != value) {
    final fieldKind = key == const Key('auth-email') ? 'email' : 'password';
    throw TestFailure('P01-2 Android text driver did not update $fieldKind field. No credentials logged.');
  }
}

// Do not rely on the email left in the controller after a failed password
// attempt. Explicitly re-enter BOTH fields for every login, including after
// change/reset. This tests the actual UI and never substitutes an API login.
Future<void> enterLoginCredentials(
    WidgetTester tester, String email, String password) async {
  await enter(tester, const Key('auth-email'), email);
  await enter(tester, const Key('auth-password'), password);
  final emailField = tester.widget<TextField>(find.byKey(const Key('auth-email')));
  final passwordField = tester.widget<TextField>(find.byKey(const Key('auth-password')));
  if (emailField.controller?.text != email ||
      passwordField.controller?.text != password) {
    throw TestFailure('P01-2 Android form changed login inputs after text entry. No credentials logged.');
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('P01-2 physical Android: real password login, access, change, recovery, logout', (tester) async {
    const base = String.fromEnvironment('ULUV_API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');
    const devKey = String.fromEnvironment('ULUV_DEV_TOKEN', defaultValue: '');
    const email = String.fromEnvironment('ULUV_P01_2_FIXTURE_EMAIL');
    const password = String.fromEnvironment('ULUV_P01_2_FIXTURE_PASSWORD');
    const uid = String.fromEnvironment('ULUV_P01_2_FIXTURE_UID');
    // Synthetic fixture only; the Dart test refuses to run without the
    // owner-hosted setup script. Do not log fixture credentials.
    if (email.isEmpty || password.isEmpty || uid.isEmpty) {
      throw TestFailure('P01-2 synthetic fixture missing. Run npm run test:flutter:p01-2:e2e.');
    }
    const nextPassword = 'DeviceChanged#P012';
    const resetPassword = 'DeviceReset!P012';
    final api = HttpAuthService(baseUrl: base, devToken: devKey);
    final observer = ObservedPasswordAuthService(api);
    await tester.pumpWidget(UluvApp(
      service: HttpDiagnosticsService(baseUrl: base, devToken: devKey),
      authService: observer,
    ));
    await tester.tap(find.byKey(const Key('open-auth')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-password-login')), findsOneWidget,
        reason: 'The P01-2 primary password UI must be shown on Android.');
    await enterLoginCredentials(tester, email, password);
    expect(tester.widget<TextField>(find.byKey(const Key('auth-password'))).controller?.text,
        password, reason: 'The real Flutter password input must contain the host-verified fixture value.');
    observer.expectLoginInputs(email, password);
    await tapAuth(tester, observer, AuthOperation.passwordLogin,
        const Key('auth-password-login'), 'Signed in with password.');
    expect(find.textContaining(uid), findsOneWidget,
        reason: 'Password sign-in must reuse the fixture\'s immutable ID.');
    await tapAuth(tester, observer, AuthOperation.me,
        const Key('auth-me'), 'Account access confirmed.');

    // Password management is a separate screen; it must not appear automatically.
    expect(find.byKey(const Key('auth-create-password')), findsNothing);
    expect(find.byKey(const Key('auth-current-password')), findsNothing);
    await tester.ensureVisible(find.byKey(const Key('auth-password-settings')));
    await tester.tap(find.byKey(const Key('auth-password-settings')));
    await tester.pumpAndSettle();
    await enter(tester, const Key('auth-current-password'), password);
    await enter(tester, const Key('auth-new-password'), nextPassword);
    observer.expectChangeInputs(password, nextPassword);
    await tapAuth(tester, observer, AuthOperation.passwordChange,
        const Key('auth-password-change'), 'Password changed. Sign in again.');
    expect(find.byKey(const Key('auth-password-login')), findsOneWidget);
    // The original host preflight only tested the password BEFORE its change.
    // Validate the new Argon2id credential on the actual Android client.
    await verifyChangedPasswordAtAPI(tester, api, email, nextPassword, uid);

    // The prior password must no longer authenticate after change, and no
    // password editing fields can be visible on the logged-out screen.
    expect(find.byKey(const Key('auth-create-password')), findsNothing);
    await enterLoginCredentials(tester, email, password);
    observer.expectLoginInputs(email, password);
    await tapAuth(tester, observer, AuthOperation.passwordLogin,
        const Key('auth-password-login'), 'Incorrect email or password.',
        shouldSucceed: false);
    // Log in with the changed password using the real Android password form.
    await enterLoginCredentials(tester, email, nextPassword);
    observer.expectLoginInputs(email, nextPassword);
    await tapAuth(tester, observer, AuthOperation.passwordLogin,
        const Key('auth-password-login'), 'Signed in with password.');
    expect(find.textContaining(uid), findsOneWidget);
    await tapAuth(tester, observer, AuthOperation.logout,
        const Key('auth-logout'), 'Signed out.');

    await tester.ensureVisible(find.byKey(const Key('auth-mode-recovery')));
    await tester.tap(find.byKey(const Key('auth-mode-recovery')));
    await tester.pumpAndSettle();
    // The API deliberately returns a privacy-safe acknowledgement whether or
    // not an email was issued. Do NOT assert the old misleading 'was issued'
    // text. The following local outbox read is what proves actual issuance.
    await tapAuth(tester, observer, AuthOperation.recoveryRequest,
        const Key('auth-recovery-request'), 'If eligible, a recovery code is available');
    await tapAuth(tester, observer, AuthOperation.recoveryOutbox,
        const Key('auth-recovery-outbox'), 'Local recovery code retrieved.');
    final recovery = find.byKey(const Key('auth-recovery-local-code'));
    expect(recovery, findsOneWidget);
    final localCode = tester.widget<SelectableText>(recovery).data!.split(': ').last;
    expect(localCode, matches(RegExp(r'^\d{6}$')));
    await enter(tester, const Key('auth-recovery-code'), localCode);
    await enter(tester, const Key('auth-recovery-password'), resetPassword);
    await enter(tester, const Key('auth-recovery-confirm'), resetPassword);
    await tapAuth(tester, observer, AuthOperation.passwordReset,
        const Key('auth-recovery-reset'), 'Password reset. Sign in with your new password.');

    // Recovery must reject the previous password while retaining the user ID.
    await enterLoginCredentials(tester, email, nextPassword);
    observer.expectLoginInputs(email, nextPassword);
    await tapAuth(tester, observer, AuthOperation.passwordLogin,
        const Key('auth-password-login'), 'Incorrect email or password.',
        shouldSucceed: false);
    await enterLoginCredentials(tester, email, resetPassword);
    observer.expectLoginInputs(email, resetPassword);
    await tapAuth(tester, observer, AuthOperation.passwordLogin,
        const Key('auth-password-login'), 'Signed in with password.');
    expect(find.textContaining(uid), findsOneWidget);
    await tapAuth(tester, observer, AuthOperation.me,
        const Key('auth-me'), 'Account access confirmed.');
    await tapAuth(tester, observer, AuthOperation.logout,
        const Key('auth-logout'), 'Signed out.');
    expect(find.byKey(const Key('auth-password-login')), findsOneWidget);
  });
}
