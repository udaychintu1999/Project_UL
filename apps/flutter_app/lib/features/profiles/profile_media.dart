import 'dart:async';
import 'dart:io';
import 'package:flutter/services.dart';
import 'profile_models.dart';

class ProfileMedia {
  const ProfileMedia({required this.mediaId, required this.refCount, this.bytes, this.width, this.height});
  final String mediaId;
  final int refCount;
  final int? bytes, width, height;
  factory ProfileMedia.fromJson(Map<String, dynamic> json) => ProfileMedia(
    mediaId: json['mediaId'] as String,
    refCount: json['refCount'] is int ? json['refCount'] as int : 0,
    bytes: json['bytes'] is int ? json['bytes'] as int : null,
    width: json['width'] is int ? json['width'] as int : null,
    height: json['height'] is int ? json['height'] as int : null,
  );
}

/// System SAF picker with no broad file/media permissions and no new Flutter dependency.
class ProfilePhotoPicker {
  const ProfilePhotoPicker();
  static const _platform = MethodChannel('uluv/p02_2_photo_picker');
  Future<Uint8List?> pick() async {
    if (!Platform.isAndroid) throw PlatformException(code: 'PICKER_ANDROID_ONLY');
    final bytes = await _platform.invokeMethod<Uint8List>('pickPhoto');
    if (bytes != null && (bytes.isEmpty || bytes.length > 8 * 1024 * 1024)) {
      throw const FormatException('Select an image smaller than 8 MB');
    }
    return bytes;
  }
}

abstract class ProfileMediaRepository {
  Future<ProfileResult<List<ProfileMedia>>> mediaLibrary();
  Future<ProfileResult<ProfileMedia>> upload(Uint8List bytes);
  Future<ProfileResult<Uint8List>> photoBytes(String mediaId);
  Future<ProfileResult<ProfileDraft>> assignPhotos(String mode, int expectedVersion, List<String> photoIds);
  Future<ProfileResult<bool>> deletePhoto(String mediaId);
}
