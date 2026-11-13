import 'dart:convert';
import 'dart:io';

class DiagnosticsReport {
  const DiagnosticsReport({required this.ok, required this.message});
  final bool ok;
  final String message;
}

abstract class DiagnosticsService {
  Future<DiagnosticsReport> checkReadiness();
  Future<DiagnosticsReport> verifyDatabase();
}

/// Validate the real API schema; an arbitrary HTTP 200 must NOT turn the UI green.
/// Pure function, covered by Flutter unit tests without contacting a server.
DiagnosticsReport parseDiagnosticsResponse({
  required String path,
  required int statusCode,
  required String body,
}) {
  Map<String, dynamic> result;
  try {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, dynamic>) {
      return const DiagnosticsReport(ok: false, message: 'Unexpected API response format');
    }
    result = decoded;
  } on FormatException {
    return const DiagnosticsReport(ok: false, message: 'Invalid JSON returned by API');
  }

  if (statusCode != HttpStatus.ok) {
    if (statusCode == HttpStatus.forbidden) {
      return const DiagnosticsReport(ok: false, message: 'Local development token rejected. Check your local configuration.');
    }
    if (statusCode == HttpStatus.serviceUnavailable) {
      return const DiagnosticsReport(ok: false, message: 'Database unavailable. Restart DynamoDB Local, then retry.');
    }
    return DiagnosticsReport(ok: false, message: 'API returned HTTP $statusCode. Check server and retry.');
  }
  if (result['status'] != 'ok' || result['database'] != 'connected') {
    return const DiagnosticsReport(ok: false, message: 'API response does not confirm a connected database');
  }
  if (path == '/health/ready' && result['service'] == 'uluv-api') {
    return const DiagnosticsReport(ok: true, message: 'API and DynamoDB Local ready');
  }
  if (path == '/v1/dev/db-roundtrip') {
    final operations = result['roundtrip'];
    if (operations is Map<String, dynamic> &&
        operations['put'] == true && operations['get'] == true &&
        operations['query'] == true && operations['delete'] == true) {
      return const DiagnosticsReport(ok: true, message: 'Database Put/Get/Query/Delete succeeded');
    }
  }
  return const DiagnosticsReport(ok: false, message: 'API returned an incomplete or unexpected diagnostic result');
}

class HttpDiagnosticsService implements DiagnosticsService {
  HttpDiagnosticsService({required this.baseUrl, required this.devToken});
  final String baseUrl;
  final String devToken;

  /// Prevent accidental transmission of a local development token to a remote host.
  Uri _localEndpoint(String path) {
    final base = Uri.parse(baseUrl);
    if (base.scheme != 'http' ||
        !{'localhost', '127.0.0.1', '::1', '10.0.2.2'}.contains(base.host) ||
        !base.hasPort || base.userInfo.isNotEmpty ||
        base.query.isNotEmpty || base.fragment.isNotEmpty ||
        (base.path.isNotEmpty && base.path != '/')) {
      throw const FormatException('P00 API URL must be local HTTP with an explicit port');
    }
    return base.replace(path: path);
  }

  Future<DiagnosticsReport> _call(String path, {bool isPost = false}) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 5);
    try {
      final endpoint = _localEndpoint(path);
      if (isPost && devToken.length < 24) {
        return const DiagnosticsReport(ok: false, message: 'Local development token missing. Configure it privately and retry.');
      }
      final request = isPost
          ? await client.postUrl(endpoint).timeout(const Duration(seconds: 6))
          : await client.getUrl(endpoint).timeout(const Duration(seconds: 6));
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (isPost) {
        request.headers.set('x-uluv-dev-key', devToken);
        request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
        request.write('{}');
      }
      final response = await request.close().timeout(const Duration(seconds: 8));
      final body = await utf8.decoder.bind(response).join().timeout(const Duration(seconds: 8));
      return parseDiagnosticsResponse(path: path, statusCode: response.statusCode, body: body);
    } catch (_) {
      // Do not show exception dumps containing URLs/headers/user-controlled data.
      return const DiagnosticsReport(ok: false, message: 'Connection failed. Check the local API address and retry.');
    } finally {
      client.close(force: true);
    }
  }

  @override
  Future<DiagnosticsReport> checkReadiness() => _call('/health/ready');
  @override
  Future<DiagnosticsReport> verifyDatabase() => _call('/v1/dev/db-roundtrip', isPost: true);
}
