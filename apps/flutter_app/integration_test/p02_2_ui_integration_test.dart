// P02-2 physical Android UI journey: the REAL UluvApp, authentication form,
// profile editor, photo buttons and local Fastify/DynamoDB backend.
//
// Only the Android SAF photo chooser is deterministic here: the test provides
// two known PNGs through the picker MethodChannel. NO fake profile repository,
// authentication service, database, photo API or profile UI is used. The real
// native picker itself has a separate physical-device/manual acceptance gate.
// The host runner creates/removes a synthetic local account and resets only
// com.example.uluv.p02isolated; NEVER touch the normal Android app's storage.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:uluv/diagnostics_service.dart';
import 'package:uluv/features/auth/auth_service.dart';
import 'package:uluv/features/auth/persistent_session.dart';
import 'package:uluv/main.dart';

const _picker = MethodChannel('uluv/p02_2_photo_picker');
const _secure = MethodChannel('uluv/p01_3_secure');

// The PNG data is small, reproducible, valid and different for each upload.
final Uint8List _firstPhoto = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGOskNvCQAgwEVQxqmgAFAEAUDIBYrTJMWAAAAAASUVORK5CYII=',
);
final Uint8List _secondPhoto = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAOCAIAAACpTQvdAAAAGUlEQVR4nGOU21LBQApgIkn1qIZRDVTUAACZvQFmo22nxwAAAABJRU5ErkJggg==',
);

void _checkpoint(int index, String verified) {
  // Checkpoint messages must come AFTER the UI assertions, never at startup.
  final phase = index > 13 ? 'P02-3' : 'P02-2';
  debugPrint('$phase UI PASS ${index.toString().padLeft(2, '0')}: $verified');
}

Future<void> _until(
  WidgetTester tester,
  String description,
  bool Function() condition, {
  Duration timeout = const Duration(seconds: 45),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 120));
    if (condition()) return;
    // Flutter's test zone does not drive real HttpClient, Keystore or Android
    // platform responses on its own. Briefly release the real async zone.
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 130)),
    );
  }
  throw TestFailure('P02-2 UI timed out: $description (no credentials logged)');
}

Finder _key(String value) => find.byKey(Key(value));

bool _canNext(WidgetTester tester) {
  return find.text('Saved and verified. You can continue.').evaluate().isNotEmpty;
}

String _field(WidgetTester tester, String key) {
  final target = _key(key);
  if (target.evaluate().isEmpty) return '';
  return tester.widget<TextField>(target).controller?.text ?? '';
}

// Guided step actions live inside the scrolling Home page, ABOVE a fixed
// bottom NavigationBar. A widget can be found and enabled yet its center can
// be behind the navigation bar (tester.tap then warns and misses). Position
// the ACTUAL pointer target within the unobstructed viewport before tapping.
// All scrolls are instant + pumped: awaiting an animated scroll here can hang
// integration_test because its fake clock is not advancing concurrently.
Future<void> _tapGuidedAction(WidgetTester tester, String key) async {
  expect(['p02-save-next', 'p02-back'], contains(key));
  final action = _key(key);
  final navigation = _key('p02-bottom-navigation');
  await _until(tester, '$key is present', () => action.evaluate().isNotEmpty);

  FocusManager.instance.primaryFocus?.unfocus();
  // Finish a page-transition frame before measuring positions and scrolling.
  await tester.pump(const Duration(milliseconds: 200));
  await _until(tester, '$key is enabled', () {
    if (action.evaluate().isEmpty) return false;
    final widget = action.evaluate().first.widget;
    return widget is ButtonStyleButton && widget.onPressed != null;
  });

  await Scrollable.ensureVisible(
    tester.element(action),
    alignment: 0.35,
    duration: Duration.zero,
    alignmentPolicy: ScrollPositionAlignmentPolicy.explicit,
  );
  await tester.pump();

  bool isClearOfBars() {
    if (action.evaluate().isEmpty || navigation.evaluate().isEmpty ||
        find.byType(AppBar).evaluate().isEmpty) return false;
    final rect = tester.getRect(action);
    final navTop = tester.getRect(navigation).top;
    final appBarBottom = tester.getRect(find.byType(AppBar).first).bottom;
    return rect.height > 0 && rect.width > 0 &&
        rect.top >= appBarBottom + 8 && rect.bottom <= navTop - 8;
  }

  // A small phone or expanded keyboard can limit the initial alignment.
  // Bounded physical drags, each followed by a frame, must resolve the
  // obstruction or FAIL. Never ignore a missed pointer or invoke onPressed.
  final homeScroll = find.ancestor(
    of: action, matching: find.byType(Scrollable),
  ).first;
  for (var attempt = 0; attempt < 8 && !isClearOfBars(); attempt++) {
    final actionTop = tester.getRect(action).top;
    final appBarBottom = tester.getRect(find.byType(AppBar).first).bottom;
    await tester.drag(homeScroll, actionTop < appBarBottom + 8
        ? const Offset(0, 145) : const Offset(0, -145));
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(isClearOfBars(), isTrue,
    reason: '$key is off-screen or overlapped by fixed navigation; '
        'the test must not report a successful Save & Next / Back.');
  debugPrint('P02-3 UI ACTION: $key unobstructed; tapping real button');
  await tester.tap(action);
  await tester.pump();
}

Future<void> _next(WidgetTester tester, String expectedStep) async {
  await _tapGuidedAction(tester, 'p02-save-next');
  await _until(tester, 'guided onboarding step: $expectedStep', () =>
      _text(tester, 'p02-step-label').contains(expectedStep));
}

Future<void> _back(WidgetTester tester, String expectedStep) async {
  await _tapGuidedAction(tester, 'p02-back');
  await _until(tester, 'guided onboarding back: $expectedStep', () =>
      _text(tester, 'p02-step-label').contains(expectedStep));
}


String _text(WidgetTester tester, String key) {
  if (_key(key).evaluate().isEmpty) return '';
  final widget = tester.widget<Text>(_key(key));
  return widget.data ?? widget.textSpan?.toPlainText() ?? '';
}

Future<void> _tap(WidgetTester tester, Finder target) async {
  await tester.ensureVisible(target);
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump();
  // A successful photo assignment can update its count before the async
  // library reload finishes. Wait for the REAL button to become enabled,
  // rather than tapping a disabled button and then timing out on the result.
  await _until(tester, 'tappable control is enabled', () {
    if (target.evaluate().isEmpty) return false;
    final widget = target.evaluate().first.widget;
    if (widget is ButtonStyleButton) return widget.onPressed != null;
    if (widget is IconButton) return widget.onPressed != null;
    if (widget is SwitchListTile) return widget.onChanged != null;
    if (widget is ChoiceChip) return widget.onSelected != null;
    if (widget is DropdownButton<String>) return widget.onChanged != null;
    return true;
  });
  await tester.tap(target);
  await tester.pump();
}

Future<void> _tapKey(WidgetTester tester, String key) =>
    _tap(tester, _key(key));

// Continue is at the bottom of a long form in a CustomScrollView, with a fixed
// NavigationBar below the viewport. `tester.ensureVisible` alone can leave its
// center underneath that bar (a tap then misses even though onPressed != null).
// This is a REAL pointer tap: never invoke the callback directly or suppress
// hit-test warnings. Fail with a useful diagnostic if the control is obstructed.
Future<void> _tapReadyContinue(WidgetTester tester) async {
  final button = _key('p02-continue');
  final navigation = _key('p02-bottom-navigation');

  // Dismissing a keyboard changes the viewport. Do it BEFORE positioning.
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump();
  await _until(tester, 'Continue is enabled before the final tap',
      () => _canContinue(tester));

  // CRITICAL: integration_test runs in the Flutter test clock. Awaiting an
  // animated Scrollable.ensureVisible BEFORE pumping frames deadlocks here:
  // PASS 12 prints, but no PASS 13 or failure ever appears. Position the real
  // viewport immediately instead; then give the layout one explicit frame.
  debugPrint('P02-2 UI STEP 13: positioning Continue for a real pointer tap');
  await Scrollable.ensureVisible(
    tester.element(button),
    alignment: 0.4,
    duration: Duration.zero,
    alignmentPolicy: ScrollPositionAlignmentPolicy.explicit,
  );
  await tester.pump();

  bool unobstructed() {
    if (button.evaluate().isEmpty || navigation.evaluate().isEmpty) {
      return false;
    }
    final rect = tester.getRect(button);
    final navigationTop = tester.getRect(navigation).top;
    final appBarBottom = tester.getRect(find.byType(AppBar).first).bottom;
    return rect.top >= appBarBottom + 8 &&
        rect.bottom <= navigationTop - 8;
  }

  // Explicit alignment may be limited by the scroll extent on short screens.
  // Scroll the actual Home viewport as a user would until the button is clear.
  final homeScroll = find.ancestor(
    of: button,
    matching: find.byType(Scrollable),
  ).first;
  for (var attempt = 0; attempt < 8 && !unobstructed(); attempt++) {
    final buttonTop = tester.getRect(button).top;
    final appBarBottom = tester.getRect(find.byType(AppBar).first).bottom;
    final delta = buttonTop < appBarBottom + 8
        ? const Offset(0, 160)
        : const Offset(0, -160);
    await tester.drag(homeScroll, delta);
    // One bounded fake-clock frame is sufficient for this drag. Waiting for
    // every animation to settle can hang behind a persistent UI animation.
    await tester.pump(const Duration(milliseconds: 100));
  }

  expect(unobstructed(), isTrue,
      reason: 'Continue must be fully visible above bottom navigation '
          'and below the app bar before a physical tap.');
  expect(_canContinue(tester), isTrue,
      reason: 'Server-confirmed onboarding must still be ready.');
  debugPrint('P02-2 UI STEP 13: Continue is visible; performing real tap');
  await tester.tap(button); // Pointer hit must reach the REAL enabled button.
  await tester.pump();
}

Future<void> _enter(WidgetTester tester, String key, String value) async {
  final target = _key(key);
  await tester.ensureVisible(target);
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pump();
  await tester.tap(target);
  await tester.pump();
  await tester.enterText(target, value);
  await tester.pump();
  expect(
    tester.widget<TextField>(target).controller?.text,
    value,
    reason: 'UI text input failed for $key',
  );
}

bool _canContinue(WidgetTester tester) {
  final target = _key('p02-continue');
  if (target.evaluate().isEmpty) return false;
  return tester.widget<FilledButton>(target).onPressed != null;
}

Finder get _reuseButtons => find.byWidgetPredicate((widget) {
  final key = widget.key;
  return widget is IconButton &&
      key is ValueKey<String> &&
      key.value.startsWith('p02-reuse-');
});

Future<void> _reuseOne(WidgetTester tester, int expectedCount) async {
  await _until(tester, 'reusable owner-owned photo available',
      () => _reuseButtons.evaluate().isNotEmpty);
  await _tap(tester, _reuseButtons.first);
  await _until(tester, '$expectedCount reusable photos assigned',
      () => find.textContaining('$expectedCount/6 assigned').evaluate().isNotEmpty);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const base = String.fromEnvironment(
    'ULUV_API_BASE_URL', defaultValue: 'http://127.0.0.1:3000');
  const dev = String.fromEnvironment('ULUV_DEV_TOKEN', defaultValue: '');
  const email = String.fromEnvironment('ULUV_P02_2_FIXTURE_EMAIL');
  const password = String.fromEnvironment('ULUV_P02_2_FIXTURE_PASSWORD');
  const uid = String.fromEnvironment('ULUV_P02_2_FIXTURE_UID');
  const isolated = bool.fromEnvironment(
    'ULUV_P02_2_ISOLATED_ANDROID_TEST', defaultValue: false);

  testWidgets(
    'P02-2 REAL Android UI: login, common/mode forms, two photos, reuse, removal and restart',
    (tester) async {
      expect(isolated, isTrue, reason: 'Must use the disposable Android app');
      expect(email, startsWith('p01-2-device-'));
      expect(uid, matches(RegExp(r'^[0-9a-f-]{36}$')));
      expect(password, isNotEmpty);
      final package = await tester.runAsync(
        () => _secure.invokeMethod<String>('applicationId'));
      expect(package, 'com.example.uluv.p02isolated',
          reason: 'Never run the UI test inside the normal U_luv app');
      final existingSession = await tester.runAsync(const AndroidDeviceVault().read);
      expect(existingSession, isNull,
          reason: 'The isolated test app must start without a prior session');

      var pickerCalls = 0;
      final messenger = TestDefaultBinaryMessengerBinding
          .instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(_picker, (call) async {
        expect(call.method, 'pickPhoto');
        final index = pickerCalls++;
        if (index == 0) return _firstPhoto;
        if (index == 1) return _secondPhoto;
        return null; // Simulated cancellation never creates server media.
      });
      try {
        Widget makeApp() => UluvApp(
          service: HttpDiagnosticsService(baseUrl: base, devToken: dev),
          authService: HttpAuthService(baseUrl: base, devToken: dev),
          persistentMode: true,
        );
        await tester.pumpWidget(makeApp());
        await _until(tester, 'real U_luv login screen',
            () => _key('auth-password-login').evaluate().isNotEmpty);
        await _enter(tester, 'auth-email', email);
        await _enter(tester, 'auth-password', password);
        await _tapKey(tester, 'auth-password-login');
        await _until(tester, 'authenticated U_luv Home',
            () => _key('p02-bottom-navigation').evaluate().isNotEmpty);
        await _until(tester, 'real profile edit fields',
            () => _key('p02-handle').evaluate().isNotEmpty);
        _checkpoint(1, 'real application login and profile Home rendered');

        final handle = 'ui${uid.replaceAll('-', '').substring(0, 18)}';
        await _enter(tester, 'p02-handle', handle);
        await _enter(tester, 'p02-common-name', 'UI Test Profile');
        await _enter(tester, 'p02-locality', 'Hyderabad');
        await _tapKey(tester, 'p02-gender');
        await tester.pumpAndSettle();
        await _tap(tester, find.text('Prefer not to say').last);
        await _tapKey(tester, 'p02-enable-dating');
        await _next(tester, 'Dating details');
        _checkpoint(2, 'handle persisted by combined Save & Next');
        _checkpoint(3, 'Common Profile and Dating saved by single action');
        expect(_canNext(tester), isFalse,
            reason: 'Cannot skip an incomplete Dating details step.');
        await _enter(tester, 'p02-bio', 'Enjoys art and thoughtful conversations');
        await _enter(tester, 'p02-intention', 'Conversation');
        await _enter(tester, 'p02-interests', 'Art, Music');
        await _next(tester, 'Dating photos');
        await _until(tester, 'Dating photo editor',
            () => _key('p02-pick-photo').evaluate().isNotEmpty);
        expect(_canNext(tester), isFalse);
        _checkpoint(4, 'Continue blocked with zero assigned photos');

        await _tapKey(tester, 'p02-pick-photo');
        await _until(tester, 'first photo preview',
            () => _key('p02-confirm-photo-upload').evaluate().isNotEmpty);
        await _tapKey(tester, 'p02-confirm-photo-upload');
        await _until(tester, 'first saved Dating photo',
            () => find.textContaining('1/6 assigned').evaluate().isNotEmpty);
        expect(_canNext(tester), isFalse);
        _checkpoint(5, 'photo-picker button → preview → real upload, one photo still blocks Continue');

        await _tapKey(tester, 'p02-pick-photo');
        await _until(tester, 'second photo preview',
            () => _key('p02-confirm-photo-upload').evaluate().isNotEmpty);
        await _tapKey(tester, 'p02-confirm-photo-upload');
        await _until(tester, 'two saved Dating photos',
            () => find.textContaining('2/6 assigned').evaluate().isNotEmpty);
        await _until(tester, 'Dating photo step unlocked by server',
            () => _canNext(tester));
        expect(pickerCalls, 2);
        _checkpoint(6, 'two photos uploaded and assigned through UI; Continue unlocked');

        // Going backwards is always allowed, but a new enabled mode must
        // complete its own details and photos before the final review.
        await _back(tester, 'Dating details');
        await _back(tester, 'Common profile');
        await _tapKey(tester, 'p02-enable-friendship');
        await _next(tester, 'Dating details'); // Saves the changed mode choice.
        await _back(tester, 'Common profile');
        expect(tester.widget<SwitchListTile>(_key('p02-enable-friendship')).value, isTrue,
            reason: 'Friendship selection must remain saved after Back.');
        await _next(tester, 'Dating details');
        await _next(tester, 'Dating photos');
        await _next(tester, 'Friendship details');
        expect(_canNext(tester), isFalse);
        _checkpoint(7, 'enabling Friendship locks Continue again');

        await _enter(tester, 'p02-bio', 'Looking for friends to explore the city');
        await _enter(tester, 'p02-intention', 'Friendship');
        await _enter(tester, 'p02-interests', 'Books, Hiking');
        await _next(tester, 'Friendship photos');
        await _until(tester, 'Friendship photo library loaded',
            () => _reuseButtons.evaluate().length >= 2);
        expect(_canNext(tester), isFalse);
        _checkpoint(8, 'Friendship details saved and previous owner photos available for reuse');

        await _reuseOne(tester, 1);
        expect(_canNext(tester), isFalse);
        await _reuseOne(tester, 2);
        await _until(tester, 'both modes meet the two-photo gate',
            () => _canNext(tester));
        expect(pickerCalls, 2,
            reason: 'Cross-mode reuse must NOT open picker or upload again');
        _checkpoint(9, 'two photos reused through Friendship UI without another upload');

        await _tapKey(tester, 'p02-photo-remove-0');
        await _until(tester, 'Friendship photo removed',
            () => find.textContaining('1/6 assigned').evaluate().isNotEmpty);
        expect(_canNext(tester), isFalse);
        await _reuseOne(tester, 2);
        await _until(tester, 'gate reopened after Friendship restoration',
            () => _canNext(tester));
        _checkpoint(10, 'removal relocks Continue and reassigning restores it');

        await _tapKey(tester, 'p02-reload');
        await _until(tester, 'saved Common Profile after in-app reload', () =>
            _field(tester, 'p02-locality') == 'Hyderabad' &&
            tester.widget<SwitchListTile>(_key('p02-enable-friendship')).value &&
            _canNext(tester));
        await _tapKey(tester, 'p02-tab-settings');
        expect(tester.widget<NavigationBar>(_key('p02-bottom-navigation'))
            .selectedIndex, 1);
        await _tapKey(tester, 'p02-tab-home');
        expect(tester.widget<NavigationBar>(_key('p02-bottom-navigation'))
            .selectedIndex, 0);
        _checkpoint(11, 'reload and Home/Settings navigation preserve saved profile');

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
        await tester.pumpWidget(makeApp());
        await _until(tester, 'Keystore-backed login restored and Common Profile reloaded', () =>
            _key('p02-common-name').evaluate().isNotEmpty &&
            _field(tester, 'p02-locality') == 'Hyderabad' &&
            tester.widget<SwitchListTile>(_key('p02-enable-friendship')).value &&
            _canNext(tester), timeout: const Duration(seconds: 70));
        _checkpoint(12, 'cold widget restart restores real session, fields and ready state');

        await _next(tester, 'Dating details');
        await _next(tester, 'Dating photos');
        await _next(tester, 'Friendship details');
        await _next(tester, 'Friendship photos');
        await _next(tester, 'Review your profile');
        await _until(tester, 'review Continue enabled', () => _canContinue(tester));
        expect(find.text('City: Hyderabad'), findsOneWidget);
        expect(find.text('Enabled modes: Dating and Friendship'), findsOneWidget);
        await _tapReadyContinue(tester);
        await _until(tester, 'profile setup completion screen',
            () => _key('p02-setup-ready').evaluate().isNotEmpty);
        expect(find.text('Profile setup complete'), findsOneWidget);
        _checkpoint(13, 'Review and Continue open private completion screen, not discovery');
        // P02-3: exercise independent real backend activation intents through
        // the visible completion UI. Neither mode becomes publicly discoverable.
        await _tapKey(tester, 'p02-activate-dating');
        await _until(tester, 'Dating activation recorded privately', () =>
            tester.widget<SwitchListTile>(_key('p02-activate-dating')).value);
        expect(find.textContaining('pending_trusted_locality'), findsWidgets);
        expect(tester.widget<SwitchListTile>(_key('p02-activate-friendship')).value, isFalse);
        _checkpoint(14, 'Dating activation is independent and pending trusted locality');
        await _tapKey(tester, 'p02-activate-friendship');
        await _until(tester, 'Friendship activation recorded privately', () =>
            tester.widget<SwitchListTile>(_key('p02-activate-friendship')).value);
        await _tapKey(tester, 'p02-owner-preview-dating');
        await _until(tester, 'private Dating preview', () =>
            find.text('Private Dating preview').evaluate().isNotEmpty);
        expect(find.textContaining('not publicly discoverable'), findsWidgets);
        await _tap(tester, find.text('Close'));
        _checkpoint(15, 'Friendship independently enabled, owner preview safe, no public discovery');
      } finally {
        messenger.setMockMethodCallHandler(_picker, null);
      }
    },
    timeout: const Timeout(Duration(minutes: 12)),
  );
}
