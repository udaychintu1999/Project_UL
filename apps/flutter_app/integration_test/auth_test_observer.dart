// Test-only P01 service adapter. The real UI tap queues the exact requested
// operation, but only WidgetTester.runAsync starts its real Android HTTP work.
// This prevents real network timers from being created in testWidgets' fake
// async zone. It never fabricates an AuthResult or bypasses Fastify/DynamoDB.
// The shipped Flutter application never imports this file.
import 'dart:async';

import 'package:uluv/features/auth/auth_service.dart';

enum AuthOperation { request, outbox, verify, me, logout }

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
