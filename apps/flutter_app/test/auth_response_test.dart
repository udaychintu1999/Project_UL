import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/auth_service.dart';

void main() {
  const outbox = '/v1/dev/otp/outbox';
  test('separate signup response preserves account creation status', () {
    final first = parseAuthResponse(path: '/v1/auth/signup/register', status: 201,
        body: '{"token":"test","account":{"uniqueId":"u"},"newAccount":true}');
    final existing = parseAuthResponse(path: '/v1/auth/email/verify', status: 200,
        body: '{"token":"test","account":{"uniqueId":"u"},"newAccount":false}');
    expect(first.newAccount, isTrue);
    expect(existing.newAccount, isFalse);
  });

  test('transport categorization never repeats exception content', () {
    expect(HttpAuthService.httpFailureCategory('Connection closed before full header was received, uri=http://SECRET'), 'response_headers_truncated');
    expect(HttpAuthService.httpFailureCategory('Headers already sent'), 'headers_committed');
    expect(HttpAuthService.httpFailureCategory('Connection reset by peer'), 'connection_closed');
    expect(HttpAuthService.httpFailureCategory('unexpected string with a secret'), 'transport_exception');
  });

  test('valid local outbox response succeeds without exposing code in the status', () {
    final result = parseAuthResponse(
      path: outbox, status: 200, body: '{"code":"012345","delivery":"local_dev_outbox"}',
    );
    expect(result.ok, isTrue);
    expect(result.code, '012345');
    expect(result.message, 'Local development code retrieved.');
    expect(result.message.contains('012345'), isFalse);
  });

  test('outbox HTTP denial is not mistaken for a network failure', () {
    final result = parseAuthResponse(path: outbox, status: 403, body: '{"error":"forbidden"}');
    expect(result.ok, isFalse);
    expect(result.message, 'Local developer access denied.');
  });

  test('invalid outbox JSON and response shape have safe, distinct messages', () {
    final invalidJson = parseAuthResponse(path: outbox, status: 200, body: 'oops');
    expect(invalidJson.ok, isFalse);
    expect(invalidJson.message, 'Local API response is not valid JSON.');
    final missingCode = parseAuthResponse(path: outbox, status: 200, body: '{"delivery":"local_dev_outbox"}');
    expect(missingCode.ok, isFalse);
    expect(missingCode.message, 'Local outbox returned an invalid code response.');
    final numericCode = parseAuthResponse(path: outbox, status: 200, body: '{"code":123456}');
    expect(numericCode.ok, isFalse);
    expect(numericCode.message, 'Local outbox returned an invalid code response.');
  });

  test('unexpected API fields do not crash the auth client', () {
    final result = parseAuthResponse(path: '/v1/auth/me', status: 200, body: '{"account":true}');
    expect(result.ok, isFalse);
    expect(result.message, 'Unexpected account response.');
  });
}
