import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'profile_media.dart';
import 'profile_models.dart';

abstract class ProfileRepository {
  Future<ProfileResult<ProfileDashboard>> dashboard();
  Future<ProfileResult<ProfileDraft>> saveDraft(String mode, int version,
    {required String displayName, required String bio,
      required List<String> interests, required String intention});
  Future<ProfileResult<String>> saveHandle(String handle, int revision);
  Future<ProfileResult<ProfileDashboard>> setModeActivation(String mode, int version, bool active);
  Future<ProfileResult<Map<String, dynamic>>> ownerPreview(String mode);
  Future<ProfileResult<ProfileDashboard>> saveSetup(int revision, {
    required String commonName, required String locality, required String gender,
    required bool dating, required bool friendship,
  });
}

/// Local API only. A fresh P01-3 token is requested for each operation, so a
/// persisted device session is renewed by the existing controller when needed.
class HttpProfileRepository implements ProfileRepository, ProfileMediaRepository {
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
      final request = await (switch (method) {
        'GET' => client.getUrl(url), 'PUT' => client.putUrl(url),
        'POST' => client.postUrl(url), 'DELETE' => client.deleteUrl(url),
        _ => throw const FormatException('Unsupported local API method'),
      })
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
  Future<ProfileResult<ProfileDashboard>> saveSetup(int revision, {
    required String commonName, required String locality, required String gender,
    required bool dating, required bool friendship,
  }) async {
    final response = await _request('PUT', '/v1/profiles/me/setup', {
      'expectedRevision': revision,
      'commonName': commonName,
      'locality': locality,
      'gender': gender,
      'selectedModes': {'dating': dating, 'friendship': friendship},
    });
    if (!response.ok) return ProfileResult.failure(response.error, response.status);
    try { return ProfileResult.success(ProfileDashboard.fromJson(response.value!)); }
    catch (_) { return const ProfileResult.failure('invalid_response', 502); }
  }

  @override
  Future<ProfileResult<ProfileDashboard>> setModeActivation(String mode, int version, bool active) async {
    if (mode != 'dating' && mode != 'friendship') {
      return const ProfileResult.failure('invalid_profile_mode', 400);
    }
    final action = active ? 'activate' : 'deactivate';
    final reply = await _request('POST', '/v1/profiles/me/$mode/$action', {
      'expectedVersion': version,
    });
    if (!reply.ok) return ProfileResult.failure(reply.error, reply.status);
    try { return ProfileResult.success(ProfileDashboard.fromJson(reply.value!)); }
    catch (_) { return const ProfileResult.failure('invalid_response', 502); }
  }

  @override
  Future<ProfileResult<Map<String, dynamic>>> ownerPreview(String mode) async {
    if (mode != 'dating' && mode != 'friendship') {
      return const ProfileResult.failure('invalid_profile_mode', 400);
    }
    return _request('GET', '/v1/profiles/me/$mode/preview', null);
  }

  @override
  Future<ProfileResult<List<ProfileMedia>>> mediaLibrary() async {
    final response = await _request('GET', '/v1/media/profile/mine', null);
    if (!response.ok) return ProfileResult.failure(response.error, response.status);
    try {
      final list = response.value!['items'];
      if (list is! List) return const ProfileResult.failure('invalid_response', 502);
      return ProfileResult.success(list.map((item) => ProfileMedia.fromJson(Map<String, dynamic>.from(item as Map))).toList());
    } catch (_) { return const ProfileResult.failure('invalid_response', 502); }
  }

  Future<ProfileResult<Uint8List>> _binary(String method, String path, [Uint8List? payload]) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 5);
    try {
      final bearer = await access();
      final uri = _endpoint(path);
      final request = await (method == 'GET' ? client.getUrl(uri) : client.putUrl(uri))
          .timeout(const Duration(seconds: 8));
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $bearer');
      request.headers.set(HttpHeaders.acceptHeader, payload == null ? 'image/jpeg' : 'application/json');
      request.persistentConnection = false;
      if (payload != null) {
        request.headers.set(HttpHeaders.contentTypeHeader, 'application/octet-stream');
        request.contentLength = payload.length;
        request.add(payload);
      }
      final reply = await request.close().timeout(const Duration(seconds: 35));
      final out = BytesBuilder(copy: false);
      await for (final chunk in reply.timeout(const Duration(seconds: 35))) {
        out.add(chunk);
        if (out.length > 8 * 1024 * 1024 + 2048) return const ProfileResult.failure('invalid_response', 502);
      }
      if (reply.statusCode == 401 || reply.statusCode == 403) await onAccessDenied?.call();
      if (reply.statusCode < 200 || reply.statusCode >= 300) {
        try {
          final decoded = jsonDecode(utf8.decode(out.takeBytes()));
          return ProfileResult.failure(decoded is Map && decoded['error'] is String
              ? decoded['error'] as String : 'media_request_failed', reply.statusCode);
        } catch (_) { return ProfileResult.failure('media_request_failed', reply.statusCode); }
      }
      return ProfileResult.success(out.takeBytes());
    } catch (_) { return const ProfileResult.failure('network_unavailable', 0); }
    finally { client.close(force: true); }
  }

  @override
  Future<ProfileResult<ProfileMedia>> upload(Uint8List bytes) async {
    if (bytes.length < 32 || bytes.length > 8 * 1024 * 1024) {
      return const ProfileResult.failure('invalid_image_size', 400);
    }
    final begin = await _request('POST', '/v1/media/profile/uploads', {});
    if (!begin.ok) return ProfileResult.failure(begin.error, begin.status);
    final id = begin.value!['mediaId'];
    if (id is! String || !RegExp(r'^[0-9a-f-]{36}$').hasMatch(id)) {
      return const ProfileResult.failure('invalid_response', 502);
    }
    final content = await _binary('PUT', '/v1/media/profile/uploads/$id/content', bytes);
    if (!content.ok) return ProfileResult.failure(content.error, content.status);
    final complete = await _request('POST', '/v1/media/profile/uploads/$id/complete', {});
    if (!complete.ok) return ProfileResult.failure(complete.error, complete.status);
    try { return ProfileResult.success(ProfileMedia.fromJson(complete.value!)); }
    catch (_) { return const ProfileResult.failure('invalid_response', 502); }
  }

  @override
  Future<ProfileResult<Uint8List>> photoBytes(String mediaId) =>
    _binary('GET', '/v1/media/profile/$mediaId/content');

  @override
  Future<ProfileResult<ProfileDraft>> assignPhotos(String mode, int expectedVersion, List<String> photoIds) async {
    if (mode != 'dating' && mode != 'friendship') return const ProfileResult.failure('invalid_profile_mode', 400);
    final update = await _request('PUT', '/v1/profiles/me/$mode/photos', {
      'expectedVersion': expectedVersion, 'photoIds': photoIds,
    });
    if (!update.ok) return ProfileResult.failure(update.error, update.status);
    // Use the canonical owner DTO rather than an incomplete update receipt.
    final dashboard = await this.dashboard();
    if (!dashboard.ok) return ProfileResult.failure(dashboard.error, dashboard.status);
    return ProfileResult.success(dashboard.value!.profiles[mode]!);
  }

  @override
  Future<ProfileResult<bool>> deletePhoto(String mediaId) async {
    final response = await _request('DELETE', '/v1/media/profile/$mediaId', null);
    if (!response.ok) return ProfileResult.failure(response.error, response.status);
    return const ProfileResult.success(true);
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
