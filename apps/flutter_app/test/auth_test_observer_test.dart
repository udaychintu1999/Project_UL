import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/auth_service.dart';

import '../integration_test/auth_test_observer.dart';

class DeferredAuthService implements AuthService {
  final requests = <String>[];
  final completers = <String, Completer<AuthResult>>{};

  Future<AuthResult> _defer(String action) {
    requests.add(action);
    final completer = Completer<AuthResult>();
    completers[action] = completer;
    return completer.future;
  }

  @override
  Future<AuthResult> requestCode(String email) => _defer('request');
  @override
  Future<AuthResult> localOutboxCode(String email) => _defer('outbox');
  @override
  Future<AuthResult> verify({required String email, required String code, required String dateOfBirth, required bool consent}) => _defer('verify');
  @override
  Future<AuthResult> me(String token) => _defer('me');
  @override
  Future<AuthResult> logout(String token) => _defer('logout');
}

void main() {
  test('observer starts no HTTP action before a test explicitly executes it', () {
    final fake = DeferredAuthService();
    final observer = ObservedAuthService(fake);
    final uiResult = observer.requestCode('synthetic@example.invalid');
    expect(uiResult, isA<Future<AuthResult>>());
    expect(observer.pending(AuthOperation.request), isNotNull);
    expect(fake.requests, isEmpty);
  });

  test('all five P01 operations delegate exactly once after an explicit execute', () async {
    final fake = DeferredAuthService();
    final observer = ObservedAuthService(fake);
    final uiFutures = <AuthOperation, Future<AuthResult>>{
      AuthOperation.request: observer.requestCode('synthetic@example.invalid'),
      AuthOperation.outbox: observer.localOutboxCode('synthetic@example.invalid'),
      AuthOperation.verify: observer.verify(email: 'synthetic@example.invalid', code: '000000', dateOfBirth: '2000-01-01', consent: true),
      AuthOperation.me: observer.me('fixture-only'),
      AuthOperation.logout: observer.logout('fixture-only'),
    };
    expect(fake.requests, isEmpty); // queueing UI requests is never a network call
    for (final entry in uiFutures.entries) {
      final action = entry.key.name;
      final execution = observer.pending(entry.key)!.execute();
      expect(fake.requests.last, action);
      fake.completers[action]!.complete(const AuthResult(ok: true, message: 'Synthetic completion'));
      final actualResult = await execution;
      expect(identical(await entry.value, actualResult), isTrue);
    }
    expect(fake.requests, ['request', 'outbox', 'verify', 'me', 'logout']);
  });

  test('the same queued operation cannot be executed twice', () async {
    final fake = DeferredAuthService();
    final observer = ObservedAuthService(fake);
    observer.me('fixture-only');
    final pending = observer.pending(AuthOperation.me)!;
    final first = pending.execute();
    await expectLater(pending.execute(), throwsStateError);
    fake.completers['me']!.complete(const AuthResult(ok: true, message: 'Synthetic completion'));
    expect((await first).ok, isTrue);
    expect(fake.requests, ['me']);
  });

  test('clear discards stale queued calls without an automatic retry', () {
    final fake = DeferredAuthService();
    final observer = ObservedAuthService(fake);
    observer.requestCode('synthetic@example.invalid');
    expect(observer.pending(AuthOperation.request), isNotNull);
    observer.clear(AuthOperation.request);
    expect(observer.pending(AuthOperation.request), isNull);
    expect(fake.requests, isEmpty);
  });
}
