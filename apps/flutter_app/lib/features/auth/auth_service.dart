import 'dart:async';
import 'dart:convert';
import 'dart:io';

class AuthResult {
  const AuthResult({required this.ok, required this.message, this.token, this.uniqueId, this.code});
  final bool ok;
  final String message;
  final String? token, uniqueId, code;
}

abstract class AuthService {
  Future<AuthResult> requestCode(String email);
  Future<AuthResult> localOutboxCode(String email);
  Future<AuthResult> verify({required String email, required String code, required String dateOfBirth, required bool consent});
  Future<AuthResult> me(String token);
  Future<AuthResult> logout(String token);
}

String authErrorMessage(String? code, int status) {
  switch (code) {
    case 'invalid_email': return 'Enter a valid email address.';
    case 'otp_cooldown': return 'Wait one minute before requesting another code.';
    case 'otp_rate_limited': return 'Too many code requests. Try again later.';
    case 'otp_attempts_exhausted': return 'Too many incorrect codes. Request a new one later.';
    case 'otp_invalid_or_used': return 'Code incorrect or already used.';
    case 'otp_expired': return 'Code expired. Request a new one.';
    case 'consent_required': return 'You must consent to sign in.';
    case 'adult_eligibility_required': return 'U_luv is available only to adults aged 18 or over.';
    case 'account_unavailable': return 'This account is not eligible for access.';
    case 'otp_used_or_identity_conflict': return 'Concurrent sign-in or a used code. Request another code.';
    case 'authentication_required':
    case 'session_expired_or_revoked': return 'Session expired. Please sign in again.';
    case 'otp_not_in_outbox': return 'Local code unavailable. Request another code when allowed.';
    case 'auth_store_unavailable': return 'Database unavailable. Restart DynamoDB Local and retry.';
    case 'forbidden': return 'Local developer access denied.';
    default: return 'Request failed (HTTP $status). Retry.';
  }
}

/// Parse a completed API response independently of the Android transport.
/// No exception from malformed server JSON should be misreported as a connection failure.
/// This parser never exposes bearer tokens or OTPs in its error messages.
AuthResult parseAuthResponse({required String path, required int status, required String body}) {
  Object? decoded;
  try {
    decoded = jsonDecode(body);
  } on FormatException {
    return const AuthResult(ok: false, message: 'Local API response is not valid JSON.');
  }
  if (decoded is! Map<String, dynamic>) {
    return const AuthResult(ok: false, message: 'Unexpected local API response format.');
  }
  if (status < 200 || status >= 300) {
    return AuthResult(
      ok: false,
      message: authErrorMessage(decoded['error'] is String ? decoded['error'] as String : null, status),
    );
  }
  final rawAccount = decoded['account'];
  final account = rawAccount is Map<String, dynamic> ? rawAccount : null;
  if (path == '/v1/auth/email/request' && decoded['status'] != 'otp_requested') {
    return const AuthResult(ok: false, message: 'Unexpected code request response.');
  }
  if (path == '/v1/auth/email/verify' &&
      (decoded['token'] is! String || account?['uniqueId'] is! String)) {
    return const AuthResult(ok: false, message: 'Unexpected sign-in response.');
  }
  if (path == '/v1/auth/me' && account?['uniqueId'] is! String) {
    return const AuthResult(ok: false, message: 'Unexpected account response.');
  }
  if (path == '/v1/dev/otp/outbox' &&
      (decoded['code'] is! String || !RegExp(r'^\d{6}$').hasMatch(decoded['code'] as String))) {
    return const AuthResult(ok: false, message: 'Local outbox returned an invalid code response.');
  }
  return AuthResult(
    ok: true,
    message: switch (path) {
      '/v1/auth/email/request' => 'Code issued to local development outbox (not a real email).',
      '/v1/auth/email/verify' => 'Signed in. Age eligibility is self-declared, not independently verified.',
      '/v1/auth/me' => 'Account access confirmed.',
      '/v1/auth/logout' => 'Signed out.',
      '/v1/dev/otp/outbox' => 'Local development code retrieved.',
      _ => 'Operation completed.',
    },
    token: decoded['token'] is String ? decoded['token'] as String : null,
    uniqueId: account?['uniqueId'] is String ? account!['uniqueId'] as String : null,
    code: decoded['code'] is String ? decoded['code'] as String : null,
  );
}

class HttpAuthService implements AuthService {
  HttpAuthService({required this.baseUrl, required this.devToken});
  final String baseUrl, devToken;

  Uri _url(String path) {
    final url = Uri.parse(baseUrl);
    if (url.scheme != 'http' ||
        !{'127.0.0.1', 'localhost', '::1', '10.0.2.2'}.contains(url.host) ||
        !url.hasPort || url.userInfo.isNotEmpty || url.query.isNotEmpty ||
        url.fragment.isNotEmpty || (url.path.isNotEmpty && url.path != '/')) {
      throw const FormatException('Only local development endpoints are allowed');
    }
    return url.replace(path: path);
  }

  // Fixed, non-sensitive operation names for diagnostic messages. Never show
  // exception.toString(), URLs, headers, response bodies, codes or tokens.
  String _operation(String path) => switch (path) {
    '/v1/auth/email/request' => 'code request',
    '/v1/dev/otp/outbox' => 'outbox read',
    '/v1/auth/email/verify' => 'code verification',
    '/v1/auth/me' => 'account check',
    '/v1/auth/logout' => 'logout',
    _ => 'authentication request',
  };

  // Return only fixed transport categories: never echo exception text, which can
  // include a URL or arbitrary response material in some Dart runtimes.
  static String httpFailureCategory(String message) {
    final normalized = message.toLowerCase();
    if (normalized.contains('header') && normalized.contains('closed')) return 'response_headers_truncated';
    if (normalized.contains('header') && (normalized.contains('sent') || normalized.contains('already'))) return 'headers_committed';
    if (normalized.contains('connection') && (normalized.contains('closed') || normalized.contains('reset'))) return 'connection_closed';
    if (normalized.contains('invalid') && normalized.contains('response')) return 'invalid_http_response';
    return 'transport_exception';
  }

  Future<AuthResult> _send(String path, Map<String, Object?>? body, {String? token, bool dev = false}) async {
    if (dev && devToken.length < 24) {
      return const AuthResult(ok: false, message: 'Local development key not configured.');
    }
    Uri endpoint;
    try {
      endpoint = _url(path);
    } on FormatException {
      return const AuthResult(ok: false, message: 'Local API address configuration invalid.');
    }

    final client = HttpClient()..connectionTimeout = const Duration(seconds: 5);
    var stage = 'connect';
    try {
      final request = await (body == null ? client.getUrl(endpoint) : client.postUrl(endpoint))
          .timeout(const Duration(seconds: 6));
      stage = 'headers';
      // Avoid reusing a potentially half-closed ADB-forwarded connection.
      // This matters only for local debug requests; no automatic OTP retry.
      request.persistentConnection = false;
      // Set every header before the payload. Use fixed Content-Length rather
      // than implicit streamed/chunked framing for these short JSON messages.
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (dev) request.headers.set('x-uluv-dev-key', devToken);
      if (token != null) request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      if (body != null) {
        final payload = utf8.encode(jsonEncode(body));
        request.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8');
        request.contentLength = payload.length;
        stage = 'write';
        request.add(payload);
      }
      stage = 'response';
      final response = await request.close().timeout(const Duration(seconds: 10));
      stage = 'body';
      final content = await utf8.decoder.bind(response).join().timeout(const Duration(seconds: 10));
      stage = 'parse';
      return parseAuthResponse(path: path, status: response.statusCode, body: content);
    } on TimeoutException {
      return AuthResult(ok: false, message: 'Local API timed out during ${_operation(path)} ($stage).');
    } on SocketException {
      return AuthResult(ok: false, message: 'Local API socket unavailable during ${_operation(path)} ($stage).');
    } on HttpException catch (error) {
      // Finite categories only, never the raw exception/URL/headers.
      final category = httpFailureCategory(error.message);
      return AuthResult(ok: false, message: 'Local API HTTP transport failed during ${_operation(path)} ($stage; $category).');
    } on FormatException {
      return AuthResult(ok: false, message: 'Local API response encoding invalid during ${_operation(path)} ($stage).');
    } on TypeError {
      return AuthResult(ok: false, message: 'Local API response type mismatch during ${_operation(path)} ($stage).');
    } catch (_) {
      return AuthResult(ok: false, message: 'Local API client error during ${_operation(path)} ($stage).');
    } finally {
      client.close(force: true);
    }
  }

  @override
  Future<AuthResult> requestCode(String email) => _send('/v1/auth/email/request', {'email': email});
  @override
  Future<AuthResult> localOutboxCode(String email) => _send('/v1/dev/otp/outbox', {'email': email}, dev: true);
  @override
  Future<AuthResult> verify({required String email, required String code, required String dateOfBirth, required bool consent}) =>
      _send('/v1/auth/email/verify', {'email': email, 'code': code, 'dateOfBirth': dateOfBirth, 'consent': consent});
  @override
  Future<AuthResult> me(String token) => _send('/v1/auth/me', null, token: token);
  @override
  Future<AuthResult> logout(String token) => _send('/v1/auth/logout', {}, token: token);
}
