import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/diagnostics_service.dart';

void main() {
  test('readiness requires real service identity and connected DB', () {
    final good = parseDiagnosticsResponse(
      path: '/health/ready', statusCode: 200,
      body: '{"status":"ok","database":"connected","service":"uluv-api"}',
    );
    expect(good.ok, isTrue);
    for (final bad in [
      '{}',
      '{"status":"ok","database":"connected"}',
      '{"status":"ok","database":"not_ready","service":"uluv-api"}',
      '<html>OK</html>',
      '[]',
    ]) {
      expect(parseDiagnosticsResponse(path: '/health/ready', statusCode: 200, body: bad).ok, isFalse);
    }
  });

  test('DB green check requires all four persisted operations', () {
    const valid = '{"status":"ok","database":"connected","roundtrip":{"put":true,"get":true,"query":true,"delete":true}}';
    expect(parseDiagnosticsResponse(path: '/v1/dev/db-roundtrip', statusCode: 200, body: valid).ok, isTrue);
    const missingDelete = '{"status":"ok","database":"connected","roundtrip":{"put":true,"get":true,"query":true}}';
    expect(parseDiagnosticsResponse(path: '/v1/dev/db-roundtrip', statusCode: 200, body: missingDelete).ok, isFalse);
  });

  test('forbidden and outage responses never report healthy', () {
    expect(parseDiagnosticsResponse(path: '/v1/dev/db-roundtrip', statusCode: 403, body: '{"error":"forbidden"}').ok, isFalse);
    expect(parseDiagnosticsResponse(path: '/health/ready', statusCode: 503, body: '{"status":"unavailable"}').ok, isFalse);
  });
}
