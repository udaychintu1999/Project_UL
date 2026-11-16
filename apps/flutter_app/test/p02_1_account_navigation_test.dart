import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/account_navigation.dart';
import 'package:uluv/features/auth/auth_screen.dart';
import 'package:uluv/features/auth/auth_service.dart';

class _AccountService implements AuthService, PasswordAuthService {
  int accountChecks = 0;
  int logouts = 0;

  @override
  Future<AuthResult> me(String token) async {
    accountChecks++;
    return const AuthResult(ok: true, message: 'Account access confirmed.', uniqueId: 'ui-user');
  }

  @override
  Future<AuthResult> logout(String token) async {
    logouts++;
    return const AuthResult(ok: true, message: 'Signed out.');
  }

  @override
  Future<AuthResult> requestCode(String email) async =>
      const AuthResult(ok: true, message: 'Requested.');

  @override
  Future<AuthResult> localOutboxCode(String email) async =>
      const AuthResult(ok: true, message: 'Available.', code: '123456');

  @override
  Future<AuthResult> verify({
    required String email,
    required String code,
    required String dateOfBirth,
    required bool consent,
  }) async => const AuthResult(ok: false, message: 'Not a sign-in test.');

  @override
  Future<AuthResult> passwordLogin(String email, String password) async =>
      const AuthResult(ok: false, message: 'Not a sign-in test.');

  @override
  Future<AuthResult> setPassword(String token, String password) async =>
      const AuthResult(ok: true, message: 'Password created.');

  @override
  Future<AuthResult> changePassword(String token, String old, String fresh) async =>
      const AuthResult(ok: false, message: 'Incorrect password.');

  @override
  Future<AuthResult> requestPasswordRecovery(String email) async =>
      const AuthResult(ok: true, message: 'Recovery requested.');

  @override
  Future<AuthResult> localPasswordRecoveryCode(String email) async =>
      const AuthResult(ok: true, message: 'Available.', code: '123456');

  @override
  Future<AuthResult> resetPassword(String email, String code, String fresh) async =>
      const AuthResult(ok: true, message: 'Password reset.');
}

void main() {
  testWidgets('signed-in home has exactly two bottom tabs; profile input survives a Settings visit', (tester) async {
    final service = _AccountService();
    await tester.pumpWidget(MaterialApp(home: AuthScreen(
      service: service,
      initialToken: 'local-session',
      initialUid: 'ui-user',
      bottomNavigation: true,
      homeContent: const TextField(key: Key('p02-unsaved-home'),
          decoration: InputDecoration(labelText: 'Unsaved draft')),
      settingsContent: const Text('Manage signed-in devices'),
    )));

    expect(find.byType(AccountNavigation), findsOneWidget);
    expect(find.byType(NavigationDestination), findsNWidgets(2));
    expect(find.byKey(const Key('p02-unsaved-home')), findsOneWidget);
    expect(find.byKey(const Key('auth-password-settings')), findsNothing);
    await tester.enterText(find.byKey(const Key('p02-unsaved-home')), 'Keep these unsaved words');
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-password-settings')), findsOneWidget);
    expect(find.text('Manage signed-in devices'), findsOneWidget);
    expect(find.byKey(const Key('auth-logout')), findsOneWidget);
    await tester.tap(find.byKey(const Key('p02-tab-home')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('p02-unsaved-home')), findsOneWidget);
    expect(find.text('Keep these unsaved words'), findsOneWidget);
  });

  testWidgets('Settings uses the existing password action and account access route', (tester) async {
    final service = _AccountService();
    await tester.pumpWidget(MaterialApp(home: AuthScreen(
      service: service,
      initialToken: 'local-session', initialUid: 'ui-user',
      bottomNavigation: true,
      homeContent: const Text('Your Dating / Friendship drafts'),
    )));
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('auth-me')));
    await tester.tap(find.byKey(const Key('auth-me')));
    await tester.pumpAndSettle();
    expect(service.accountChecks, 1);
    await tester.ensureVisible(find.byKey(const Key('auth-password-settings')));
    await tester.tap(find.byKey(const Key('auth-password-settings')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-open-change-password')), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('auth-open-change-password')));
    await tester.tap(find.byKey(const Key('auth-open-change-password')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-current-password')), findsOneWidget);
    await tester.tap(find.byKey(const Key('p02-tab-home')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-current-password')), findsNothing,
        reason: 'Sensitive form state must be reset when leaving Settings.');
  });

  testWidgets('small screen keeps bottom navigation tappable and Android Back stays in app', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var selected = 0;
    await tester.pumpWidget(MaterialApp(home: StatefulBuilder(builder: (context, setState) {
      return AccountNavigation(
        selectedIndex: selected,
        onSelect: (tab) => setState(() => selected = tab),
        onBack: () => setState(() => selected = 0),
        home: const Text('Profile editor'),
        settings: const Text('Security controls'),
      );
    })));
    expect(tester.takeException(), isNull);
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pumpAndSettle();
    expect(find.text('Security controls'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Profile editor'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('long profile Continue can be scrolled clear of the fixed navigation bar', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var proceeded = false;
    await tester.pumpWidget(MaterialApp(home: AccountNavigation(
      selectedIndex: 0,
      onSelect: (_) {},
      onBack: () {},
      home: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < 22; i++)
          SizedBox(height: 72, child: Text('Profile field $i')),
        FilledButton(
          key: const Key('p02-scroll-continue'),
          onPressed: () => proceeded = true,
          child: const Text('Continue'),
        ),
        const SizedBox(height: 100),
      ]),
      settings: const Text('Settings'),
    )));

    final button = find.byKey(const Key('p02-scroll-continue'));
    final navigation = find.byKey(const Key('p02-bottom-navigation'));
    await Scrollable.ensureVisible(
      tester.element(button),
      alignment: 0.4,
      duration: Duration.zero,
      alignmentPolicy: ScrollPositionAlignmentPolicy.explicit,
    );
    await tester.pump();
    expect(tester.getRect(button).bottom,
        lessThan(tester.getRect(navigation).top - 8),
        reason: 'A long profile form must not leave Continue behind bottom navigation');
    await tester.tap(button);
    await tester.pump();
    expect(proceeded, isTrue, reason: 'A genuine on-screen pointer tap must reach Continue');
  });

}
