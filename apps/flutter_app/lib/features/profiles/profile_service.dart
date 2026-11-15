import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'profile_models.dart';

abstract class ProfileRepository {
  Future<ProfileResult<ProfileDashboard>> dashboard();
  Future<ProfileResult<ProfileDraft>> saveDraft(String mode, int version,
    {required String displayName, required String bio,
      required List<String> interests, required String intention});
  Future<ProfileResult<String>> saveHandle(String handle, int revision);
}

/// Local API only. A fresh P01-3 token is requested for each operation, so a
/// persisted device session is renewed by the existing controller when needed.
class HttpProfileRepository implements ProfileRepository {
  const HttpProfileRepository({required this.baseUrl, required this.access, this.onAccessDenied});
  final String baseUrl;
  final Future<String> Function() access;
  final Future<void> Function()? onAccessDenied;

  Uri _endpoint(String path) {
    final base = Uri.parse(baseUrl);
    if (base.scheme != 'http' ||
        !{'127.0.0.1', 'localhost', '::1', '10.0.2.2'}.contains(base.host) ||
        !base.hasPort || base.userInfo.isNotEmpty || base.query.isNotEmpty ||
        base.fragment.isNotEmpty || (base.path.isNotEmpty && base.path != '/')) {
      throw const FormatException('Invalid local API address');
    }
    return base.replace(path: path);
  }

  Future<ProfileResult<Map<String, dynamic>>> _request(String method,
    String path, Map<String, Object?>? payload) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 5);
    try {
      final url = _endpoint(path);
      final bearer = await access(); // Never keep a stale access token in a form.
      final request = await (method == 'GET' ? client.getUrl(url) : client.putUrl(url))
        .timeout(const Duration(seconds: 8));
      request.persistentConnection = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $bearer');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (payload != null) {
        final bytes = utf8.encode(jsonEncode(payload));
        request.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8');
        request.contentLength = bytes.length;
        request.add(bytes);
      }
      final response = await request.close().timeout(const Duration(seconds: 12));
      final body = await utf8.decoder.bind(response).join().timeout(const Duration(seconds: 12));
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return const ProfileResult.failure('invalid_response', 502);
      if (response.statusCode == 401 || response.statusCode == 403) {
        try { await onAccessDenied?.call(); } catch (_) { /* fail closed in caller */ }
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return ProfileResult.failure(decoded['error'] is String
            ? decoded['error'] as String : 'profile_request_failed', response.statusCode);
      }
      return ProfileResult.success(decoded);
    } on FormatException {
      return const ProfileResult.failure('invalid_response', 502);
    } on TimeoutException {
      return const ProfileResult.failure('network_unavailable', 0);
    } on SocketException {
      return const ProfileResult.failure('network_unavailable', 0);
    } on HttpException {
      return const ProfileResult.failure('network_unavailable', 0);
    } catch (_) {
      // Session exceptions and malformed responses must never expose tokens.
      return const ProfileResult.failure('session_or_network_unavailable', 0);
    } finally {
      client.close(force: true);
    }
  }

  @override
  Future<ProfileResult<ProfileDashboard>> dashboard() async {
    final response = await _request('GET', '/v1/profiles/me', null);
    if (!response.ok) return ProfileResult.failure(response.error, response.status);
    try { return ProfileResult.success(ProfileDashboard.fromJson(response.value!)); }
    on FormatException { return const ProfileResult.failure('invalid_response', 502); }
    catch (_) { return const ProfileResult.failure('invalid_response', 502); }
  }

  @override
  Future<ProfileResult<ProfileDraft>> saveDraft(String mode, int version,
      {required String displayName, required String bio,
        required List<String> interests, required String intention}) async {
    if (mode != 'dating' && mode != 'friendship') {
      return const ProfileResult.failure('invalid_profile_mode', 400);
    }
    final response = await _request('PUT', '/v1/profiles/me/$mode', {
      'expectedVersion': version, 'displayName': displayName,
      'bio': bio, 'interests': interests, 'intention': intention,
    });
    if (!response.ok) return ProfileResult.failure(response.error, response.status);
    return ProfileResult.success(ProfileDraft.fromJson(response.value!));
  }

  @override
  Future<ProfileResult<String>> saveHandle(String handle, int revision) async {
    final response = await _request('PUT', '/v1/profiles/me/handle', {
      'handle': handle, 'expectedRevision': revision,
    });
    if (!response.ok) return ProfileResult.failure(response.error, response.status);
    final stored = response.value!['handle'];
    if (stored is! String) return const ProfileResult.failure('invalid_response', 502);
    return ProfileResult.success(stored);
  }
}
