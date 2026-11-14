// Test-only P01-2 observer must not create a real network operation inside
// testWidgets' fake async zone, and each queued password operation runs once.
import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/auth_service.dart';
import '../integration_test/auth_test_observer.dart';

class FakePasswordDelegate implements PasswordAuthService, AuthService {
  final calls = <String>[];
  final completers = <String, Completer<AuthResult>>{};
  Future<AuthResult> hold(String action) {
    calls.add(action);
    final pending = Completer<AuthResult>();
    completers[action] = pending;
    return pending.future;
  }
  Future<AuthResult> requestCode(String email) => hold('request');
  Future<AuthResult> localOutboxCode(String email) => hold('outbox');
  Future<AuthResult> verify({required String email,required String code,required String dateOfBirth,required bool consent}) => hold('verify');
  Future<AuthResult> me(String token) => hold('me');
  Future<AuthResult> logout(String token) => hold('logout');
  Future<AuthResult> passwordLogin(String email,String password) => hold('passwordLogin');
  Future<AuthResult> setPassword(String token,String password) => hold('passwordSet');
  Future<AuthResult> changePassword(String token,String currentPassword,String newPassword) => hold('passwordChange');
  Future<AuthResult> requestPasswordRecovery(String email) => hold('recoveryRequest');
  Future<AuthResult> localPasswordRecoveryCode(String email) => hold('recoveryOutbox');
  Future<AuthResult> resetPassword(String email,String code,String newPassword) => hold('passwordReset');
}

void main() {
  test('P01-2 observer compares UI input without logging fixture credentials', () {
    final observer = ObservedPasswordAuthService(
        HttpAuthService(baseUrl: 'http://127.0.0.1:3000', devToken: ''));
    observer.expectLoginInputs('test@example.invalid', 'Expected#2026');
    final beforeCorrect = observer.expectedLoginFieldMatches(
        'test@example.invalid', 'Expected#2026');
    expect(beforeCorrect?.email, isTrue);
    expect(beforeCorrect?.password, isTrue);
    final beforeWrongEmail = observer.expectedLoginFieldMatches(
        'changed@example.invalid', 'Expected#2026');
    expect(beforeWrongEmail?.email, isFalse);
    expect(beforeWrongEmail?.password, isTrue);
    observer.passwordLogin('test@example.invalid', 'Wrong#2026');
    expect(observer.lastLoginInputsMatch, isFalse);
    expect(observer.lastLoginEmailMatch, isTrue);
    expect(observer.lastLoginPasswordMatch, isFalse);
    observer.expectLoginInputs('test@example.invalid', 'Expected#2026');
    observer.passwordLogin('test@example.invalid', 'Expected#2026');
    expect(observer.lastLoginInputsMatch, isTrue);
    expect(observer.lastLoginEmailMatch, isTrue);
    expect(observer.lastLoginPasswordMatch, isTrue);
    expect(observer.expectedLoginFieldMatches('test@example.invalid', 'Expected#2026'), isNull,
        reason: 'Expectations are cleared after the service callback; no replay.');
    observer.expectChangeInputs('Old#2026', 'New#2026');
    observer.changePassword('synthetic-token', 'Old#2026', 'Changed#2026');
    expect(observer.lastChangeInputsMatch, isFalse);
    observer.expectChangeInputs('Old#2026', 'New#2026');
    observer.changePassword('synthetic-token', 'Old#2026', 'New#2026');
    expect(observer.lastChangeInputsMatch, isTrue);
    // These calls are deliberately never executed: this is an isolated
    // equality/queuing test, with zero HTTP requests and zero real secrets.
  });

  test('P01-2 six password operations are queued, executed once, and completed', () async {
    final fake = FakePasswordDelegate();
    // The device observer constructor accepts the concrete service, so its
    // underlying queue semantics are checked using PendingAuthCall directly.
    final actions = <String>['passwordLogin','passwordSet','passwordChange',
      'recoveryRequest','recoveryOutbox','passwordReset'];
    for (final name in actions) {
      final call = PendingAuthCall(() => fake.hold(name));
      expect(fake.calls, isNot(contains(name)));
      final ui = call.uiResult;
      final started = call.execute();
      expect(fake.calls.last, name);
      await expectLater(call.execute(), throwsStateError);
      fake.completers[name]!.complete(const AuthResult(ok: true,message: 'Done'));
      final result = await started;
      expect(result.ok, isTrue);
      expect(identical(await ui,result), isTrue);
    }
    expect(fake.calls, actions);
  });
}
