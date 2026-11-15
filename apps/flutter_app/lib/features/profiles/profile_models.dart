/// Owner-only P02-1 profile DTOs; never constructed from untrusted public projections.
class ProfileDraft {
  const ProfileDraft({required this.mode, required this.exists, required this.version,
    required this.displayName, required this.bio, required this.interests,
    required this.intention, required this.missing});

  final String mode;
  final bool exists;
  final int version;
  final String displayName, bio, intention;
  final List<String> interests, missing;

  factory ProfileDraft.fromJson(Map<String, dynamic> json) {
    final completeness = json['completeness'];
    return ProfileDraft(
      mode: json['mode'] == 'friendship' ? 'friendship' : 'dating',
      exists: json['exists'] == true,
      version: json['version'] is int ? json['version'] as int : 0,
      displayName: json['displayName'] is String ? json['displayName'] as String : '',
      bio: json['bio'] is String ? json['bio'] as String : '',
      interests: (json['interests'] is List ? json['interests'] as List : const [])
        .whereType<String>().toList(growable: false),
      intention: json['intention'] is String ? json['intention'] as String : '',
      missing: (completeness is Map && completeness['missing'] is List
        ? completeness['missing'] as List : const [])
        .whereType<String>().toList(growable: false),
    );
  }
}

class ProfileDashboard {
  const ProfileDashboard({required this.handle, required this.identityRevision,
    required this.locality, required this.profiles});
  final String? handle, locality;
  final int identityRevision;
  final Map<String, ProfileDraft> profiles;

  factory ProfileDashboard.fromJson(Map<String, dynamic> json) {
    final profiles = json['profiles'];
    if (profiles is! Map || profiles['dating'] is! Map || profiles['friendship'] is! Map) {
      throw const FormatException('Invalid profile dashboard response');
    }
    return ProfileDashboard(
      handle: json['handle'] is String ? json['handle'] as String : null,
      locality: json['locality'] is String ? json['locality'] as String : null,
      identityRevision: json['identityRevision'] is int ? json['identityRevision'] as int : 1,
      profiles: {
        'dating': ProfileDraft.fromJson(Map<String, dynamic>.from(profiles['dating'] as Map)),
        'friendship': ProfileDraft.fromJson(Map<String, dynamic>.from(profiles['friendship'] as Map)),
      },
    );
  }
}

class ProfileResult<T> {
  const ProfileResult.success(this.value) : error = null, status = 200;
  const ProfileResult.failure(this.error, this.status) : value = null;
  final T? value;
  final String? error;
  final int status;
  bool get ok => value != null && error == null;
}
