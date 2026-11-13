import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:uluv/diagnostics_service.dart';
import 'package:uluv/features/auth/auth_service.dart';
import 'package:uluv/main.dart';

import 'auth_test_observer.dart';

// On-device HTTP must START within WidgetTester.runAsync, not inside a
// fake-clock widget pump. Every operation is first requested by a real UI tap.
// The test-only adapter then invokes the real service exactly once.
String authStatus(WidgetTester tester) {
  final finder = find.byKey(const Key('auth-message'));
  if (finder.evaluate().isEmpty) return '<status widget unavailable>';
  final widget = tester.widget<Text>(finder);
  return widget.data ?? widget.textSpan?.toPlainText() ?? '<empty status>';
}

Future<void> tapAndWaitForAuth(
  WidgetTester tester, {
  required ObservedAuthService observer,
  required AuthOperation action,
  required Key button,
  required String operation,
  required String expectedStatus,
  Future<String> Function()? failureProbe,
}) async {
  final target = find.byKey(button);
  await tester.ensureVisible(target);
  await tester.pumpAndSettle(); // finish animations before tapping
  observer.clear(action); // a prior operation cannot masquerade as this tap
  await tester.tap(target);
  await tester.pump(); // deliver the tap and start the real service call

  final inFlight = observer.pending(action);
  if (inFlight == null) {
    throw TestFailure('$operation did not start after its button was tapped. UI status: ${authStatus(tester)}');
  }

  // Flutter's testWidgets body uses a fake async clock. Start AND await the
  // actual Android/HttpClient operation in the real async zone. Never retry.
  final result = await tester.runAsync(
    () => inFlight.execute().timeout(const Duration(seconds: 35)),
  );
  if (result == null) {
    throw TestFailure('$operation did not complete in the real asynchronous test zone. No request was retried.');
  }

  await tester.pumpAndSettle(); // rebuild the UI after the awaited result
  final visibleStatus = authStatus(tester);
  if (!result.ok || !visibleStatus.startsWith(expectedStatus)) {
    final extra = failureProbe == null ? '' : ' | local API probe: ${await failureProbe()}';
    // Both result.message and visibleStatus are sanitized by the app. Never
    // log OTPs, email addresses, tokens, headers or request/response bodies.
    throw TestFailure('$operation failed: ${result.message}; UI status: $visibleStatus$extra');
  }
}

// If the real service returns an error, probe both P00 GET and authenticated
// POST from the same Android process. This distinguishes server/ADB trouble
// from a P01-specific issue without reporting the development key or OTP.
Future<String> probeLocalTransport(WidgetTester tester, String base, String key) async {
  final result = await tester.runAsync(() async {
    final diagnostic = HttpDiagnosticsService(baseUrl: base, devToken: key);
    final read = await diagnostic.checkReadiness();
    final write = await diagnostic.verifyDatabase();
    return 'readiness GET: ${read.message}; diagnostic POST: ${write.message}';
  });
  return result ?? 'Android transport probe did not complete';
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('P01 device → Fastify → local outbox → real DynamoDB identity → logout', (tester) async {
    const base = String.fromEnvironment('ULUV_API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');
    const devKey = String.fromEnvironment('ULUV_DEV_TOKEN', defaultValue: '');
    final email = 'p01-android-${DateTime.now().microsecondsSinceEpoch}@example.invalid';
    final observer = ObservedAuthService(HttpAuthService(baseUrl: base, devToken: devKey));
    await tester.pumpWidget(UluvApp(
      service: HttpDiagnosticsService(baseUrl: base, devToken: devKey),
      authService: observer,
    ));
    await tester.tap(find.byKey(const Key('open-auth')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('auth-email')), email);

    await tapAndWaitForAuth(tester,
      observer: observer, action: AuthOperation.request,
      button: const Key('auth-request'),
      operation: 'OTP request',
      expectedStatus: 'Code issued to local development outbox',
      failureProbe: () => probeLocalTransport(tester, base, devKey));
    await tapAndWaitForAuth(tester,
      observer: observer, action: AuthOperation.outbox,
      button: const Key('auth-outbox'),
      operation: 'Local development outbox read',
      expectedStatus: 'Local development code retrieved.',
      failureProbe: () => probeLocalTransport(tester, base, devKey));

    final found = find.byKey(const Key('auth-local-code'));
    expect(found, findsOneWidget,
      reason: 'Outbox returned success, but the local-code widget is missing.');
    final codeText = tester.widget<SelectableText>(found).data!;
    final code = codeText.split(': ').last;
    expect(code, matches(RegExp(r'^\d{6}$')));
    await tester.enterText(find.byKey(const Key('auth-code')), code);
    await tester.ensureVisible(find.byKey(const Key('auth-dob')));
    await tester.tap(find.byKey(const Key('auth-dob')));
    await tester.pumpAndSettle();
    // The adult eligibility boundary is separately covered by backend tests.
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('auth-consent')));
    await tester.tap(find.byKey(const Key('auth-consent')));
    await tester.pumpAndSettle();

    await tapAndWaitForAuth(tester,
      observer: observer, action: AuthOperation.verify,
      button: const Key('auth-verify'),
      operation: 'OTP verification / registration',
      expectedStatus: 'Signed in.',
      failureProbe: () => probeLocalTransport(tester, base, devKey));
    expect(find.textContaining('Account ID:'), findsOneWidget);
    await tapAndWaitForAuth(tester,
      observer: observer, action: AuthOperation.me,
      button: const Key('auth-me'),
      operation: 'Authenticated account access',
      expectedStatus: 'Account access confirmed.',
      failureProbe: () => probeLocalTransport(tester, base, devKey));
    await tapAndWaitForAuth(tester,
      observer: observer, action: AuthOperation.logout,
      button: const Key('auth-logout'),
      operation: 'Session logout',
      expectedStatus: 'Signed out.',
      failureProbe: () => probeLocalTransport(tester, base, devKey));
    expect(find.byKey(const Key('auth-request')), findsOneWidget);
  });
}
