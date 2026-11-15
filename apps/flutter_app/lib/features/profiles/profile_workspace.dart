import 'package:flutter/material.dart';
import 'profile_models.dart';
import 'profile_service.dart';

/// An in-place authenticated panel. Unlike a pushed route, it is immediately
/// destroyed when PersistentAuthGate hides the account after logout/revocation.
class ProfileWorkspace extends StatefulWidget {
  const ProfileWorkspace({super.key, required this.repository, this.initiallyExpanded = false});
  final bool initiallyExpanded;
  final ProfileRepository repository;
  @override
  State<ProfileWorkspace> createState() => _ProfileWorkspaceState();
}

class _ProfileWorkspaceState extends State<ProfileWorkspace> {
  final handle = TextEditingController();
  final displayName = TextEditingController();
  final bio = TextEditingController();
  final interests = TextEditingController();
  final intention = TextEditingController();
  ProfileDashboard? dashboard;
  String mode = 'dating';
  bool expanded = false, busy = false, dirty = false;
  String notice = '';

  @override
  void initState() {
    super.initState();
    expanded = widget.initiallyExpanded;
    if (expanded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) load(first: true);
      });
    }
  }

  @override
  void dispose() {
    handle.dispose(); displayName.dispose(); bio.dispose();
    interests.dispose(); intention.dispose();
    super.dispose();
  }

  void loadMode(String next) {
    mode = next;
    final profile = dashboard?.profiles[next];
    displayName.text = profile?.displayName ?? '';
    bio.text = profile?.bio ?? '';
    interests.text = profile?.interests.join(', ') ?? '';
    intention.text = profile?.intention ?? '';
    dirty = false;
  }

  Future<void> load({bool first = false}) async {
    if (busy) return;
    if (dirty && !first) {
      final discard = await confirmDiscard();
      if (!discard || !mounted) return;
    }
    setState(() { busy = true; notice = 'Loading your profile drafts...'; });
    try {
      final result = await widget.repository.dashboard();
      if (!mounted) return;
      if (!result.ok) {
        setState(() {
          if (result.status == 401 || result.status == 403) {
            dashboard = null;
            handle.clear(); loadMode(mode);
          }
          notice = describe(result.error, result.status);
        });
        return;
      }
      setState(() {
        dashboard = result.value;
        handle.text = dashboard?.handle ?? '';
        loadMode(mode);
        notice = 'Drafts loaded from your account.';
      });
    } catch (_) {
      if (mounted) setState(() => notice = 'Unable to load profiles. Retry.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<bool> confirmDiscard() async {
    if (!dirty) return true;
    return (await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Discard unsaved changes?'),
      content: const Text('Your saved draft will remain unchanged.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep editing')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Discard changes')),
      ],
    ))) ?? false;
  }

  Future<void> switchMode(String next) async {
    if (busy || next == mode) return;
    if (!await confirmDiscard() || !mounted) return;
    setState(() { loadMode(next); notice = 'Editing ${mode == 'dating' ? 'Dating' : 'Friendship'} draft.'; });
  }

  Future<void> saveHandle() async {
    if (busy || dashboard == null || dirty) return;
    setState(() { busy = true; notice = 'Saving account handle...'; });
    try {
      final result = await widget.repository.saveHandle(handle.text, dashboard!.identityRevision);
      if (!mounted) return;
      if (result.ok) {
        setState(() { notice = 'Handle saved. Refreshing your profile...'; });
      } else {
        setState(() {
          if (result.status == 401 || result.status == 403) {
            dashboard = null; handle.clear(); loadMode(mode);
          }
          notice = describe(result.error, result.status);
        });
        return;
      }
    } catch (_) {
      if (mounted) setState(() => notice = 'Unable to save handle. Please retry.');
      return;
    } finally {
      if (mounted) setState(() => busy = false);
    }
    if (mounted) await load(first: true);
  }

  Future<void> saveDraft() async {
    if (busy || dashboard == null) return;
    final current = dashboard!.profiles[mode]!;
    final tags = interests.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    if (tags.length > 10 || tags.any((s) => s.length > 32) ||
        displayName.text.characters.length > 60 ||
        bio.text.characters.length > 500 || intention.text.characters.length > 80) {
      setState(() => notice = 'Please shorten the name, bio, intention or interests (maximum 10).');
      return;
    }
    setState(() { busy = true; notice = 'Saving the ${mode == 'dating' ? 'Dating' : 'Friendship'} draft...'; });
    try {
      final result = await widget.repository.saveDraft(mode, current.version,
          displayName: displayName.text, bio: bio.text, interests: tags,
          intention: intention.text);
      if (!mounted) return;
      if (!result.ok) {
        setState(() {
          if (result.status == 401 || result.status == 403) {
            dashboard = null;
            handle.clear(); loadMode(mode);
          }
          notice = describe(result.error, result.status);
        });
        return;
      }
      final next = result.value!;
      setState(() {
        dashboard!.profiles[mode] = next;
        loadMode(mode);
        notice = 'Draft saved to your account. Photo uploads and activation come in later P02 milestones.';
      });
    } catch (_) {
      if (mounted) setState(() => notice = 'Draft not confirmed saved. Reload to check before retrying.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String describe(String? error, int status) {
    switch (error) {
      case 'handle_taken': return 'That handle is already in use. Choose another.';
      case 'invalid_handle': return 'Use 3–24 letters, numbers or underscores; start with a letter.';
      case 'invalid_profile_text': case 'invalid_interests': case 'duplicate_interests':
        return 'Check your draft: remove contact details, links, duplicate interests and oversized text.';
      case 'profile_version_conflict': case 'identity_revision_conflict':
        return 'Another edit was saved first. Copy your changes, then reload to review before saving again.';
      case 'authentication_required': case 'session_expired_or_revoked':
        return 'Your session is no longer available. Sign in again.';
      case 'account_unavailable': return 'Profile editing is unavailable for this account.';
      default: return status == 0 || status >= 500
          ? 'Connection or server unavailable. Reload to check what was saved.'
          : 'Could not complete this action. Please review and try again.';
    }
  }

  Widget editField(String key, String label, TextEditingController controller,
      {int lines = 1, int? length}) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: TextField(
      key: Key(key), controller: controller, maxLines: lines, maxLength: length,
      enabled: !busy, onChanged: (_) => setState(() => dirty = true),
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
    ),
  );

  @override
  Widget build(BuildContext context) {
    if (!expanded) {
      return FilledButton.tonalIcon(
        key: const Key('p02-open-profiles'),
        onPressed: () { setState(() => expanded = true); load(first: true); },
        icon: const Icon(Icons.person_outline),
        label: const Text('Set up Dating / Friendship profiles'),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Divider(height: 32),
      Text('Your profiles', style: Theme.of(context).textTheme.titleLarge),
      const Text('Separate Dating and Friendship drafts. Saving a draft never makes you discoverable.'),
      const SizedBox(height: 12),
      if (busy) const LinearProgressIndicator(key: Key('p02-progress')),
      Semantics(liveRegion: true, child: Text(notice, key: const Key('p02-notice'))),
      const SizedBox(height: 12),
      if (dashboard == null) ...[
        if (!busy) OutlinedButton(key: const Key('p02-load-retry'), onPressed: () => load(first: true),
          child: const Text('Retry loading profiles')),
      ] else ...[
        TextField(key: const Key('p02-handle'), controller: handle, enabled: !busy,
          maxLength: 24, decoration: const InputDecoration(
            labelText: 'Your account handle', prefixText: '@', border: OutlineInputBorder(),
            helperText: 'One handle shared by both profiles.' )),
        OutlinedButton(key: const Key('p02-save-handle'),
          onPressed: busy || dirty ? null : saveHandle, child: const Text('Save handle')),
        if (dirty) const Text('Save or discard your draft edits before changing your handle.'),
        const SizedBox(height: 12),
        Wrap(spacing: 8, children: [
          ChoiceChip(key: const Key('p02-mode-dating'),
            label: const Text('Dating'), selected: mode == 'dating',
            onSelected: busy ? null : (_) => switchMode('dating')),
          ChoiceChip(key: const Key('p02-mode-friendship'),
            label: const Text('Friendship'), selected: mode == 'friendship',
            onSelected: busy ? null : (_) => switchMode('friendship')),
        ]),
        Text('Draft version ${dashboard!.profiles[mode]!.version}${dashboard!.profiles[mode]!.exists ? '' : ' (new)'}'),
        editField('p02-name', 'Display name for this mode', displayName, length: 60),
        editField('p02-bio', 'Short bio (no contact links or numbers)', bio, lines: 3, length: 500),
        editField('p02-intention', 'What are you looking for?', intention, length: 80),
        editField('p02-interests', 'Interests, comma-separated (up to 10)', interests),
        const SizedBox(height: 12),
        Text('Still needed before activation: ${dashboard!.profiles[mode]!.missing.join(', ')}',
          key: const Key('p02-missing')),
        const SizedBox(height: 12),
        FilledButton(key: const Key('p02-save-draft'), onPressed: busy ? null : saveDraft,
          child: const Text('Save draft')),
        TextButton(key: const Key('p02-reload'), onPressed: busy ? null : load,
          child: const Text('Reload saved profiles')),
        const Text('Photos, locality selection and activation are not available in P02-1.'),
      ],
    ]);
  }
}
