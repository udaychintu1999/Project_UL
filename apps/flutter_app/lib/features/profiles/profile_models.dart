/// Owner-only P02-1 profile DTOs; never constructed from untrusted public projections.
class ProfileDraft {
  const ProfileDraft({required this.mode, required this.exists, required this.version,
    required this.displayName, required this.bio, required this.interests,
    required this.intention, required this.missing, this.photoIds = const [],
    this.requestedActive = false, this.visibility = 'inactive',
    this.activationMissing = const [], this.discoveryEligible = false});

  final String mode;
  final bool exists;
  final int version;
  final String displayName, bio, intention;
  final List<String> interests, missing, photoIds, activationMissing;
  final bool requestedActive, discoveryEligible;
  final String visibility;

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
      photoIds: (json['photoIds'] is List ? json['photoIds'] as List : const []).whereType<String>().toList(growable: false),
      requestedActive: json['requestedActive'] == true,
      discoveryEligible: json['discoveryEligible'] == true,
      visibility: json['visibility'] is String ? json['visibility'] as String : 'inactive',
      activationMissing: (json['activationMissing'] is List ? json['activationMissing'] as List : const [])
        .whereType<String>().toList(growable: false),
      missing: (completeness is Map && completeness['missing'] is List
        ? completeness['missing'] as List : const [])
        .whereType<String>().toList(growable: false),
    );
  }
}

/// Private account-level setup data. Locality is self-declared and must not
/// be treated as a verified discovery location or published coordinates.
class SharedProfile {
  const SharedProfile({this.commonName = '', this.locality = '', this.gender = '',
    this.age, this.setupRevision = 0, this.dating = false, this.friendship = false});
  final String commonName, locality, gender;
  final int? age;
  final int setupRevision;
  final bool dating, friendship;

  factory SharedProfile.fromJson(Map<String, dynamic> json) {
    final selected = json['selectedModes'];
    final modes = selected is Map ? selected : const <String, dynamic>{};
    return SharedProfile(
      commonName: json['commonName'] is String ? json['commonName'] as String : '',
      locality: json['locality'] is String ? json['locality'] as String : '',
      gender: json['gender'] is String ? json['gender'] as String : '',
      age: json['age'] is int ? json['age'] as int : null,
      setupRevision: json['setupRevision'] is int ? json['setupRevision'] as int : 0,
      dating: modes['dating'] == true, friendship: modes['friendship'] == true,
    );
  }
}

class OnboardingStatus {
  const OnboardingStatus({this.ready = false, this.missing = const []});
  final bool ready;
  final List<String> missing;
  factory OnboardingStatus.fromJson(Map<String, dynamic> json) => OnboardingStatus(
    ready: json['ready'] == true,
    missing: (json['missing'] is List ? json['missing'] as List : const [])
      .whereType<String>().toList(growable: false),
  );
}

class ProfileDashboard {
  const ProfileDashboard({required this.handle, required this.identityRevision,
    required this.locality, required this.profiles,
    this.shared = const SharedProfile(), this.onboarding = const OnboardingStatus()});
  final String? handle, locality;
  final int identityRevision;
  final Map<String, ProfileDraft> profiles;
  final SharedProfile shared;
  final OnboardingStatus onboarding;

  factory ProfileDashboard.fromJson(Map<String, dynamic> json) {
    final profiles = json['profiles'];
    if (profiles is! Map || profiles['dating'] is! Map || profiles['friendship'] is! Map) {
      throw const FormatException('Invalid profile dashboard response');
    }
    return ProfileDashboard(
      handle: json['handle'] is String ? json['handle'] as String : null,
      locality: json['locality'] is String ? json['locality'] as String : null,
      identityRevision: json['identityRevision'] is int ? json['identityRevision'] as int : 1,
      shared: json['shared'] is Map
        ? SharedProfile.fromJson(Map<String, dynamic>.from(json['shared'] as Map))
        : const SharedProfile(),
      onboarding: json['onboarding'] is Map
        ? OnboardingStatus.fromJson(Map<String, dynamic>.from(json['onboarding'] as Map))
        : const OnboardingStatus(),
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
