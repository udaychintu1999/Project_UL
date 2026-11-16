import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'profile_media.dart';
import 'profile_models.dart';

/// Private P02-2 photo library. Attaching a photo is not discovery activation.
class ProfilePhotosPanel extends StatefulWidget {
  const ProfilePhotosPanel({super.key, required this.repository, required this.mode,
    required this.profile, required this.onUpdated, this.pickPhoto});
  final ProfileMediaRepository repository;
  final String mode;
  final ProfileDraft profile;
  final ValueChanged<ProfileDraft> onUpdated;
  final Future<Uint8List?> Function()? pickPhoto;

  @override
  State<ProfilePhotosPanel> createState() => _ProfilePhotosPanelState();
}

class _ProfilePhotosPanelState extends State<ProfilePhotosPanel> {
  List<ProfileMedia> library = [];
  final Map<String, Future<ProfileResult<Uint8List>>> previews = {};
  Uint8List? pendingPhoto;
  int? replacingIndex;
  bool busy = false;
  String message = '';

  @override
  void initState() { super.initState(); _loadLibrary(); }

  Future<void> _loadLibrary() async {
    final result = await widget.repository.mediaLibrary();
    if (!mounted) return;
    setState(() {
      if (result.ok) library = result.value!;
      else message = _message(result.error);
    });
  }

  String _message(String? error) {
    switch (error) {
      case 'media_in_use': return 'This photo is still used by Dating or Friendship. Remove its assignments first.';
      case 'invalid_image': case 'invalid_image_size': case 'image_too_large':
      case 'image_too_large_or_wrong_type':
        return 'Choose a valid JPEG, PNG or WebP photo under 8 MB.';
      case 'photo_assignment_conflict': case 'profile_version_conflict':
        return 'Photo order changed elsewhere. Reload the profile, then retry.';
      case 'media_library_full': return 'Your private library is full. Delete unused photos before adding more.';
      case 'network_unavailable': case 'media_store_unavailable':
        return 'Connection or local photo storage unavailable. Retry the operation.';
      default: return 'Photo operation failed. Check your connection and retry.';
    }
  }

  Future<void> _pick({int? replaceAt}) async {
    if (busy) return;
    try {
      final picked = await (widget.pickPhoto?.call() ?? const ProfilePhotoPicker().pick());
      if (!mounted || picked == null) return;
      setState(() { pendingPhoto = picked; replacingIndex = replaceAt; message = 'Preview selected photo before uploading.'; });
    } catch (_) {
      if (mounted) setState(() => message = 'Could not read this photo. Choose another image under 8 MB.');
    }
  }

  List<String> _assignWith(String id, {int? replaceAt}) {
    final current = List<String>.from(widget.profile.photoIds);
    if (replaceAt != null) {
      if (replaceAt < 0 || replaceAt >= current.length) return current;
      current[replaceAt] = id;
      if (current.toSet().length != current.length) return current; // no duplicate photo refs
    } else if (!current.contains(id) && current.length < 6) {
      current.add(id);
    }
    return current;
  }

  Future<void> _assign(List<String> next) async {
    if (busy || next.length > 6 || next.toSet().length != next.length) return;
    setState(() { busy = true; message = 'Saving ${widget.mode} photo order...'; });
    try {
      final result = await widget.repository.assignPhotos(widget.mode, widget.profile.version, next);
      if (!mounted) return;
      if (result.ok) {
        widget.onUpdated(result.value!);
        setState(() => message = 'Photos saved privately for ${widget.mode}.');
        await _loadLibrary();
      } else { setState(() => message = _message(result.error)); }
    } finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _upload() async {
    final photo = pendingPhoto;
    if (busy || photo == null) return;
    setState(() { busy = true; message = 'Uploading and validating your photo locally...'; });
    try {
      final uploaded = await widget.repository.upload(photo);
      if (!mounted) return;
      if (!uploaded.ok) { setState(() => message = _message(uploaded.error)); return; }
      final replacing = replacingIndex;
      final next = _assignWith(uploaded.value!.mediaId, replaceAt: replacing);
      setState(() { pendingPhoto = null; replacingIndex = null; busy = false; });
      if (next.length == widget.profile.photoIds.length &&
          next.join('|') == widget.profile.photoIds.join('|')) {
        // No slot available or attempted duplicate; photo remains in library.
        await _loadLibrary();
        setState(() => message = 'Uploaded to your private library. Select a slot to assign it.');
      } else { await _assign(next); }
    } catch (_) {
      if (mounted) setState(() => message = 'Upload not confirmed. Review the photo library before trying again.');
    } finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _delete(String id) async {
    if (busy) return;
    setState(() { busy = true; message = 'Removing unused private photo...'; });
    try {
      final result = await widget.repository.deletePhoto(id);
      if (!mounted) return;
      setState(() => message = result.ok ? 'Unused photo deleted.' : _message(result.error));
      if (result.ok) { previews.remove(id); await _loadLibrary(); }
    } finally { if (mounted) setState(() => busy = false); }
  }

  Widget _thumbnail(String id) {
    final future = previews.putIfAbsent(id, () => widget.repository.photoBytes(id));
    return FutureBuilder<ProfileResult<Uint8List>>(future: future, builder: (context, snapshot) {
      if (!snapshot.hasData) return const SizedBox(width: 84, height: 84,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
      final data = snapshot.data;
      if (data?.ok != true) return const SizedBox(width: 84, height: 84,
        child: Icon(Icons.broken_image_outlined));
      return Image.memory(data!.value!, width: 84, height: 84,
        fit: BoxFit.cover, gaplessPlayback: true,
        errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined));
    });
  }

  @override
  Widget build(BuildContext context) {
    final attached = widget.profile.photoIds;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Photos · ${widget.mode == 'dating' ? 'Dating' : 'Friendship'}',
        style: Theme.of(context).textTheme.titleMedium),
      Text('${attached.length}/6 assigned. At least 2 validated, saved photos are required for this enabled mode before Continue. Discovery activation is a separate later step.'),
      if (message.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8),
        child: Semantics(liveRegion: true, child: Text(message,
          key: const Key('p02-photo-message'),
          style: RegExp(r'failed|invalid|cannot|could not|unavailable|changed elsewhere|still used|retry',
              caseSensitive: false).hasMatch(message)
              ? TextStyle(color: Theme.of(context).colorScheme.error,
                  fontWeight: FontWeight.w700)
              : null))),
      if (busy) const LinearProgressIndicator(key: Key('p02-photo-progress')),
      for (var index = 0; index < attached.length; index++)
        Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
          _thumbnail(attached[index]),
          const SizedBox(width: 8),
          Expanded(child: Text('Photo ${index + 1}')),
          IconButton(key: Key('p02-photo-up-$index'), tooltip: 'Move photo up',
            onPressed: busy || index == 0 ? null : () {
              final next = List<String>.from(attached);
              final previous = next[index - 1]; next[index - 1] = next[index]; next[index] = previous;
              _assign(next);
            }, icon: const Icon(Icons.arrow_upward)),
          IconButton(key: Key('p02-photo-down-$index'), tooltip: 'Move photo down',
            onPressed: busy || index == attached.length - 1 ? null : () {
              final next = List<String>.from(attached);
              final after = next[index + 1]; next[index + 1] = next[index]; next[index] = after;
              _assign(next);
            }, icon: const Icon(Icons.arrow_downward)),
          IconButton(key: Key('p02-photo-replace-$index'), tooltip: 'Replace this photo',
            onPressed: busy ? null : () => _pick(replaceAt: index), icon: const Icon(Icons.swap_horiz)),
          IconButton(key: Key('p02-photo-remove-$index'), tooltip: 'Remove from this mode',
            onPressed: busy ? null : () => _assign([...attached]..removeAt(index)),
            icon: const Icon(Icons.remove_circle_outline)),
        ])),
      const SizedBox(height: 8),
      OutlinedButton.icon(key: const Key('p02-pick-photo'),
        onPressed: busy || attached.length >= 6 ? null : () => _pick(),
        icon: const Icon(Icons.add_photo_alternate_outlined), label: const Text('Select photo from device')),
      if (pendingPhoto != null) ...[
        const SizedBox(height: 8),
        Image.memory(pendingPhoto!, height: 180, fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => const Text('Preview unavailable; invalid images are rejected by the server.')),
        FilledButton(key: const Key('p02-confirm-photo-upload'), onPressed: busy ? null : _upload,
          child: Text(replacingIndex == null ? 'Upload and add photo' : 'Upload and replace photo')),
        TextButton(key: const Key('p02-cancel-photo-upload'), onPressed: busy ? null : () => setState(() {
          pendingPhoto = null; replacingIndex = null;
        }), child: const Text('Cancel selection')),
      ],
      const SizedBox(height: 12),
      Text('My private photo library', style: Theme.of(context).textTheme.titleSmall),
      const Text('Reuse a photo in both modes without uploading again. Deletion is allowed only when no mode uses it.'),
      TextButton(key: const Key('p02-refresh-photo-library'), onPressed: busy ? null : _loadLibrary,
        child: const Text('Refresh photo library')),
      for (final item in library.take(24))
        Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
          _thumbnail(item.mediaId),
          const SizedBox(width: 8),
          Expanded(child: Text('Used in ${item.refCount} mode(s)')),
          if (!attached.contains(item.mediaId))
            IconButton(key: Key('p02-reuse-${item.mediaId}'), tooltip: 'Use in this mode',
              onPressed: busy || attached.length >= 6 ? null : () => _assign([...attached, item.mediaId]),
              icon: const Icon(Icons.add_circle_outline)),
          IconButton(key: Key('p02-delete-${item.mediaId}'), tooltip: 'Delete unused image',
            onPressed: busy || item.refCount != 0 ? null : () => _delete(item.mediaId),
            icon: const Icon(Icons.delete_outline)),
        ])),
    ]);
  }
}
