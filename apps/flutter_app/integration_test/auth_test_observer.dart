// Test-only P01 service adapter. The real UI tap queues the exact requested
// operation, but only WidgetTester.runAsync starts its real Android HTTP work.
// This prevents real network timers from being created in testWidgets' fake
// async zone. It never fabricates an AuthResult or bypasses Fastify/DynamoDB.
// The shipped Flutter application never imports this file.
import 'dart:async';

import 'package:uluv/features/auth/auth_service.dart';

enum AuthOperation { request, outbox, verify, me, logout, passwordLogin, passwordSet, passwordChange, recoveryRequest, recoveryOutbox, passwordReset }

class PendingAuthCall {
  PendingAuthCall(this._invoke);

  final Future<AuthResult> Function() _invoke;
  final Completer<AuthResult> _completion = Completer<AuthResult>();
  bool _started = false;

  // The real AuthScreen awaits this Future as usual.
  Future<AuthResult> get uiResult => _completion.future;

  // Called exactly once from WidgetTester.runAsync, never during a widget pump.
  Future<AuthResult> execute() async {
    if (_started) throw StateError('Authentication test call already executed');
    _started = true;
    try {
      final result = await _invoke();
      _completion.complete(result);
      return result;
    } catch (error, stack) {
      _completion.completeError(error, stack);
      rethrow;
    }
  }
}

class ObservedAuthService implements AuthService {
  ObservedAuthService(this.delegate);

  final AuthService delegate;
  final Map<AuthOperation, PendingAuthCall> _pending = {};

  void clear(AuthOperation operation) {
    _pending.remove(operation);
  }

  PendingAuthCall? pending(AuthOperation operation) => _pending[operation];

  Future<AuthResult> _record(AuthOperation operation, Future<AuthResult> Function() invoke) {
    final call = PendingAuthCall(invoke);
    _pending[operation] = call;
    return call.uiResult;
  }

  @override
  Future<AuthResult> requestCode(String email) =>
      _record(AuthOperation.request, () => delegate.requestCode(email));

  @override
  Future<AuthResult> localOutboxCode(String email) =>
      _record(AuthOperation.outbox, () => delegate.localOutboxCode(email));

  @override
  Future<AuthResult> verify({required String email, required String code, required String dateOfBirth, required bool consent}) =>
      _record(AuthOperation.verify, () => delegate.verify(email: email, code: code, dateOfBirth: dateOfBirth, consent: consent));

  @override
  Future<AuthResult> me(String token) =>
      _record(AuthOperation.me, () => delegate.me(token));

  @override
  Future<AuthResult> logout(String token) =>
      _record(AuthOperation.logout, () => delegate.logout(token));
}


/// P01-2 test-only adapter. Preserve the P01-1 adapter's OTP-only behavior,
/// while exposing password methods so AuthScreen renders its real password UI.
/// No service call happens until the test executes its queued operation.
class ObservedPasswordAuthService extends ObservedAuthService implements PasswordAuthService {
  ObservedPasswordAuthService(HttpAuthService delegate)
      : passwordDelegate = delegate, super(delegate);

  final PasswordAuthService passwordDelegate;

  // Test-only equality checks: never store/print the credentials themselves.
  // Keep email and password comparisons separate: on a physical Android
  // device the IME/autofill service may mutate just one field between the
  // test's enterText and the button's onPressed callback.
  bool Function(String email)? _expectedLoginEmail;
  bool Function(String password)? _expectedLoginPassword;
  bool Function(String current, String next)? _expectedChange;
  bool? lastLoginInputsMatch;
  bool? lastLoginEmailMatch;
  bool? lastLoginPasswordMatch;
  bool? lastChangeInputsMatch;

  void expectLoginInputs(String email, String password) {
    _expectedLoginEmail = (actual) => actual == email;
    _expectedLoginPassword = (actual) => actual == password;
    lastLoginInputsMatch = null;
    lastLoginEmailMatch = null;
    lastLoginPasswordMatch = null;
  }

  // Inspect controller values BEFORE the UI button tap without capturing or
  // printing credentials. This is a diagnostic only; no authentication bypass.
  ({bool email, bool password})? expectedLoginFieldMatches(
      String email, String password) {
    final emailCheck = _expectedLoginEmail;
    final passwordCheck = _expectedLoginPassword;
    if (emailCheck == null || passwordCheck == null) return null;
    return (email: emailCheck(email), password: passwordCheck(password));
  }

  void expectChangeInputs(String currentPassword, String nextPassword) {
    _expectedChange = (actualCurrent, actualNext) =>
        actualCurrent == currentPassword && actualNext == nextPassword;
    lastChangeInputsMatch = null;
  }

  @override
  Future<AuthResult> passwordLogin(String email, String password) {
    lastLoginEmailMatch = _expectedLoginEmail?.call(email);
    lastLoginPasswordMatch = _expectedLoginPassword?.call(password);
    lastLoginInputsMatch = lastLoginEmailMatch == null || lastLoginPasswordMatch == null
        ? null
        : lastLoginEmailMatch! && lastLoginPasswordMatch!;
    _expectedLoginEmail = null;
    _expectedLoginPassword = null;
    return _record(AuthOperation.passwordLogin,
        () => passwordDelegate.passwordLogin(email, password));
  }
  @override
  Future<AuthResult> setPassword(String token, String password) =>
      _record(AuthOperation.passwordSet, () => passwordDelegate.setPassword(token, password));
  @override
  Future<AuthResult> changePassword(String token, String oldPassword, String newPassword) {
    lastChangeInputsMatch = _expectedChange?.call(oldPassword, newPassword);
    _expectedChange = null;
    return _record(AuthOperation.passwordChange,
        () => passwordDelegate.changePassword(token, oldPassword, newPassword));
  }
  @override
  Future<AuthResult> requestPasswordRecovery(String email) =>
      _record(AuthOperation.recoveryRequest, () => passwordDelegate.requestPasswordRecovery(email));
  @override
  Future<AuthResult> localPasswordRecoveryCode(String email) =>
      _record(AuthOperation.recoveryOutbox, () => passwordDelegate.localPasswordRecoveryCode(email));
  @override
  Future<AuthResult> resetPassword(String email, String code, String newPassword) =>
      _record(AuthOperation.passwordReset, () => passwordDelegate.resetPassword(email, code, newPassword));
}
