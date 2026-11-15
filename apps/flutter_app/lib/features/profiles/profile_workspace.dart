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
  final commonName = TextEditingController();
  final locality = TextEditingController();
  String gender = '';
  bool datingEnabled = false, friendshipEnabled = false;
  bool commonDirty = false, handleDirty = false, readySummary = false;
  ProfileDashboard? dashboard;
  String mode = 'dating';
  bool expanded = false, busy = false, dirty = false;
  String notice = '';
  String handleError = '';

  // Handle is an account-level operation, independent of unsaved mode/common
  // fields. Use the controller value as the source of truth during rebuilds.
  bool get hasPendingHandle => dashboard != null &&
      handle.text.trim().replaceFirst(RegExp(r'^@'), '').toLowerCase() !=
          (dashboard!.handle ?? '') && handle.text.trim().isNotEmpty;

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
    commonName.dispose(); locality.dispose();
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

  void loadCommon() {
    final shared = dashboard?.shared;
    // Prefill from an existing P02-1 draft once; never overwrite its own name.
    // The owner must save this shared value explicitly before it counts.
    final previousName = dashboard?.profiles['dating']?.displayName.isNotEmpty == true
        ? dashboard!.profiles['dating']!.displayName
        : (dashboard?.profiles['friendship']?.displayName ?? '');
    final suggestedName = shared?.setupRevision == 0 && (shared?.commonName ?? '').isEmpty
        ? previousName : '';
    commonName.text = (shared?.commonName ?? '').isNotEmpty
        ? shared!.commonName : suggestedName;
    locality.text = shared?.locality ?? '';
    gender = shared?.gender ?? '';
    datingEnabled = shared?.dating ?? false;
    friendshipEnabled = shared?.friendship ?? false;
    commonDirty = suggestedName.isNotEmpty;
  }

  Future<void> saveCommon() async {
    if (busy || dashboard == null || !commonDirty) return;
    if (commonName.text.characters.length > 60 || locality.text.characters.length > 60) {
      setState(() => notice = 'Use up to 60 characters for your name and broad locality.');
      return;
    }
    setState(() { busy = true; notice = 'Saving your common profile and mode choices...'; });
    try {
      final result = await widget.repository.saveSetup(dashboard!.shared.setupRevision,
        commonName: commonName.text, locality: locality.text, gender: gender,
        dating: datingEnabled, friendship: friendshipEnabled);
      if (!mounted) return;
      if (!result.ok) {
        setState(() {
          if (result.status == 401 || result.status == 403) {
            dashboard = null;
            handle.clear(); handleDirty = false; loadMode(mode); loadCommon();
          }
          notice = describe(result.error, result.status);
        });
        return;
      }
      setState(() {
        dashboard = result.value;
        loadCommon();
        // Preserve a mode draft being typed before common details were saved.
        if (!dirty) loadMode(mode);
        notice = 'Common profile saved. Complete each enabled mode to continue.';
      });
    } catch (_) {
      if (mounted) setState(() => notice = 'Common profile not confirmed saved. Reload before retrying.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  /// Refresh server-computed setup status without overwriting local form edits.
  /// Handle saving is independent of draft/common saving, so it must preserve
  /// *all* editor controllers even if a dirty flag has not rebuilt yet.
  Future<void> refreshAfterDraftSave({bool preserveEditors = false}) async {
    try {
      final result = await widget.repository.dashboard();
      if (!mounted) return;
      if (!result.ok) {
        if (result.status == 401 || result.status == 403) {
          setState(() {
            dashboard = null; handle.clear(); handleDirty = false;
            loadMode(mode); loadCommon();
            notice = 'Account access changed. Sign in again.';
          });
        } else {
          setState(() => notice = 'Saved changes need a fresh status check. Reload your profile.');
        }
        return;
      }
      setState(() {
        dashboard = result.value;
        if (!preserveEditors && !commonDirty) loadCommon();
        if (!preserveEditors && !dirty) loadMode(mode);
        notice = 'Saved details and setup status refreshed.';
      });
    } catch (_) { // Persisted draft succeeded; a subsequent status read may fail.
      if (mounted) setState(() => notice = 'Draft saved. Reload to confirm setup readiness.');
    }
  }

  Future<void> load({bool first = false}) async {
    if (busy) return;
    if ((dirty || commonDirty || handleDirty) && !first) {
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
            handle.clear(); handleDirty = false; loadMode(mode); loadCommon();
          }
          notice = describe(result.error, result.status);
        });
        return;
      }
      setState(() {
        dashboard = result.value;
        handle.text = dashboard?.handle ?? '';
        handleDirty = false;
        handleError = '';
        loadMode(mode);
        loadCommon();
        if (first && dashboard!.onboarding.ready) readySummary = true;
        notice = 'Saved profile details loaded from your account.';
      });
    } catch (_) {
      if (mounted) setState(() => notice = 'Unable to load profiles. Retry.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<bool> confirmDiscard({bool modeOnly = false}) async {
    if (modeOnly ? !dirty : (!dirty && !commonDirty && !handleDirty)) return true;
    return (await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: Text(modeOnly ? 'Discard unsaved mode edits?' : 'Discard unsaved changes?'),
      content: const Text('Your saved draft will remain unchanged.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep editing')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Discard changes')),
      ],
    ))) ?? false;
  }

  Future<void> switchMode(String next) async {
    if (busy || next == mode) return;
    if (dirty && (!await confirmDiscard(modeOnly: true) || !mounted)) return;
    setState(() { loadMode(next); notice = 'Editing ${mode == 'dating' ? 'Dating' : 'Friendship'} draft.'; });
  }

  Future<void> saveHandle() async {
    if (busy || !hasPendingHandle) return;
    setState(() { busy = true; handleError = ''; notice = 'Saving account handle...'; });
    try {
      final result = await widget.repository.saveHandle(handle.text, dashboard!.identityRevision);
      if (!mounted) return;
      if (!result.ok) {
        setState(() {
          if (result.status == 401 || result.status == 403) {
            dashboard = null; handle.clear(); handleDirty = false; loadMode(mode); loadCommon();
          }
          notice = describe(result.error, result.status);
          handleError = notice;
        });
        return;
      }
      // Saving a handle must never discard a typed, unsaved bio, common name,
      // or mode selection. The old load(first: true) reset those controllers.
      setState(() {
        handle.text = result.value!;
        handleDirty = false;
        handleError = '';
        // The successful CAS increments this revision by exactly one. Keep
        // the successful handle usable if the subsequent readiness read fails.
        final previous = dashboard!;
        dashboard = ProfileDashboard(
          handle: result.value, identityRevision: previous.identityRevision + 1,
          locality: previous.locality, profiles: previous.profiles,
          shared: previous.shared, onboarding: previous.onboarding,
        );
        notice = 'Handle saved. Refreshing setup readiness...';
      });
      // Refresh identity and setup status, but never reload either form here.
      // The handle write is independent; even a recently edited field whose
      // onChanged rebuild is pending must retain its typed controller value.
      await refreshAfterDraftSave(preserveEditors: true);
    } catch (_) {
      if (mounted) setState(() {
        notice = 'Handle may have saved. Reload to confirm before retrying.';
        handleError = notice;
      });
    } finally {
      if (mounted) setState(() => busy = false);
    }
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
            handle.clear(); handleDirty = false; loadMode(mode); loadCommon();
          }
          notice = describe(result.error, result.status);
        });
        return;
      }
      final next = result.value!;
      setState(() {
        dashboard!.profiles[mode] = next;
        loadMode(mode);
        notice = 'Draft saved. Checking which setup details are still required...';
      });
      // Keep the save operation busy through the authoritative readiness read.
      // Previously busy briefly became false before this awaited refresh;
      // widgets could observe a stale, disabled Continue button.
      await refreshAfterDraftSave();
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
      case 'setup_revision_conflict':
        return 'Your common profile was updated elsewhere. Reload and review before saving again.';
      case 'invalid_common_name': case 'invalid_broad_locality': case 'invalid_gender':
      case 'invalid_mode_selection': case 'invalid_shared_profile': case 'invalid_shared_profile_fields':
        return 'Review your common name and city. Do not include contact details, addresses, numbers or links.';
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

  String missingLabel(String item) {
    const labels = <String, String>{
      'handle': 'Choose and save your account @handle',
      'ageEligibility': 'Contact support: your saved adult eligibility needs review',
      'commonName': 'Enter your common profile name',
      'locality': 'Enter your broad city/locality (not your address)',
      'selectMode': 'Enable Dating, Friendship or both',
      'dating.draft': 'Save your Dating details',
      'friendship.draft': 'Save your Friendship details',
      'dating.bio': 'Add a Dating bio',
      'friendship.bio': 'Add a Friendship bio',
      'dating.intention': 'Add your Dating intention',
      'friendship.intention': 'Add your Friendship intention',
      'dating.interests': 'Add at least one Dating interest',
      'friendship.interests': 'Add at least one Friendship interest',
      'dating.displayName': 'Add a Dating name or common name',
      'friendship.displayName': 'Add a Friendship name or common name',
    };
    return labels[item] ?? item;
  }

  @override
  Widget build(BuildContext context) {
    if (!expanded) {
      return FilledButton.tonalIcon(
        key: const Key('p02-open-profiles'),
        onPressed: () { setState(() => expanded = true); load(first: true); },
        icon: const Icon(Icons.person_outline),
        label: const Text('Set up your profile'),
      );
    }
    final ready = dashboard?.onboarding.ready == true;
    if (ready && readySummary) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Icon(Icons.check_circle_outline, size: 50, color: Colors.green),
        const SizedBox(height: 12),
        Text('Profile setup complete', style: Theme.of(context).textTheme.titleLarge,
          key: const Key('p02-setup-ready')),
        const Text('You have saved your common details and completed every enabled connection mode.'),
        const SizedBox(height: 8),
        const Text('Your profile is still private. Photo uploads, activation and the discovery home screen arrive in later phases.'),
        const SizedBox(height: 16),
        FilledButton.tonal(key: const Key('p02-edit-setup'),
          onPressed: () => setState(() => readySummary = false),
          child: const Text('Edit my profile details')),
        TextButton(key: const Key('p02-ready-reload'), onPressed: busy ? null : () async {
          setState(() => readySummary = false);
          await load(first: true);
        }, child: const Text('Refresh saved setup status')),
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Set up your profile', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 5),
      const Text('Complete your common details once, enable at least one mode, and fill in its details. Photos are not required for this setup step.'),
      const SizedBox(height: 12),
      if (busy) const LinearProgressIndicator(key: Key('p02-progress')),
      Semantics(liveRegion: true, child: Text(notice, key: const Key('p02-notice'))),
      const SizedBox(height: 12),
      if (dashboard == null) ...[
        if (!busy) OutlinedButton(key: const Key('p02-load-retry'), onPressed: () => load(first: true),
          child: const Text('Retry loading profiles')),
      ] else ...[
        Text('1 · Common profile', style: Theme.of(context).textTheme.titleMedium),
        const Text('Shared by Dating and Friendship. Never enter a street address.'),
        const SizedBox(height: 10),
        TextField(key: const Key('p02-handle'), controller: handle, enabled: !busy,
          onChanged: (_) => setState(() {
            handleDirty = handle.text.trim().replaceFirst(RegExp(r'^@'), '').toLowerCase() != (dashboard?.handle ?? '');
            handleError = '';
          }),
          maxLength: 24, decoration: const InputDecoration(
            labelText: 'Public account handle', prefixText: '@', border: OutlineInputBorder(),
            helperText: 'One unique handle shared by both modes.')),
        OutlinedButton(key: const Key('p02-save-handle'),
          onPressed: busy || !hasPendingHandle ? null : saveHandle,
          child: const Text('Save handle')),
        if (handleError.isNotEmpty)
          Text(handleError, key: const Key('p02-handle-error'),
            style: TextStyle(color: Theme.of(context).colorScheme.error)),
        Padding(padding: const EdgeInsets.only(top: 12), child: TextField(
          key: const Key('p02-common-name'), controller: commonName, maxLength: 60,
          enabled: !busy, onChanged: (_) => setState(() => commonDirty = true),
          decoration: const InputDecoration(labelText: 'Common display name', border: OutlineInputBorder()),
        )),
        const SizedBox(height: 12),
        TextField(key: const Key('p02-locality'), controller: locality, maxLength: 60,
          enabled: !busy, onChanged: (_) => setState(() => commonDirty = true),
          decoration: const InputDecoration(labelText: 'City or broad locality',
            helperText: 'Example: Hyderabad. No street, GPS or postal code.',
            border: OutlineInputBorder())),
        const SizedBox(height: 8),
        Text('Age: ${dashboard!.shared.age?.toString() ?? 'unavailable'} (derived from the date of birth supplied at signup)'),
        const SizedBox(height: 12),
        InputDecorator(
          decoration: const InputDecoration(labelText: 'Gender (optional)', border: OutlineInputBorder()),
          child: DropdownButtonHideUnderline(child: DropdownButton<String>(
          key: const Key('p02-gender'), value: gender, isExpanded: true,
          items: const [
            DropdownMenuItem(value: '', child: Text('Prefer not to specify')),
            DropdownMenuItem(value: 'woman', child: Text('Woman')),
            DropdownMenuItem(value: 'man', child: Text('Man')),
            DropdownMenuItem(value: 'non_binary', child: Text('Non-binary')),
            DropdownMenuItem(value: 'another_identity', child: Text('Another identity')),
            DropdownMenuItem(value: 'prefer_not_to_say', child: Text('Prefer not to say')),
          ],
          onChanged: busy ? null : (value) => setState(() {
            gender = value ?? '';
            commonDirty = true;
          }),
        ))),
        const SizedBox(height: 20),
        Text('2 · Choose your connection modes', style: Theme.of(context).textTheme.titleMedium),
        const Text('Enable one or both. Only enabled modes count toward finishing setup.'),
        SwitchListTile(key: const Key('p02-enable-dating'),
          title: const Text('Enable Dating'), value: datingEnabled,
          onChanged: busy ? null : (value) => setState(() {
            datingEnabled = value; commonDirty = true;
          })),
        SwitchListTile(key: const Key('p02-enable-friendship'),
          title: const Text('Enable Friendship'), value: friendshipEnabled,
          onChanged: busy ? null : (value) => setState(() {
            friendshipEnabled = value; commonDirty = true;
          })),
        const SizedBox(height: 8),
        FilledButton.tonal(key: const Key('p02-save-common'),
          onPressed: busy || !commonDirty ? null : saveCommon,
          child: const Text('Save common details and mode choices')),
        if (commonDirty) const Text('Unsaved common changes do not count toward setup completion.'),
        const SizedBox(height: 20),
        Text('3 · Mode-specific details', style: Theme.of(context).textTheme.titleMedium),
        const Text('A nickname here is optional; if empty, your common name is used. Bio, intention and at least one interest are required for each enabled mode.'),
        const SizedBox(height: 12),
        Wrap(spacing: 8, children: [
          ChoiceChip(key: const Key('p02-mode-dating'),
            label: Text(datingEnabled ? 'Dating · enabled' : 'Dating'), selected: mode == 'dating',
            onSelected: busy ? null : (_) => switchMode('dating')),
          ChoiceChip(key: const Key('p02-mode-friendship'),
            label: Text(friendshipEnabled ? 'Friendship · enabled' : 'Friendship'), selected: mode == 'friendship',
            onSelected: busy ? null : (_) => switchMode('friendship')),
        ]),
        Text('Draft version ${dashboard!.profiles[mode]!.version}${dashboard!.profiles[mode]!.exists ? '' : ' (new)'}'),
        if (!(mode == 'dating' ? datingEnabled : friendshipEnabled))
          const Text('This mode is not enabled. You can still prepare and save its private draft.'),
        editField('p02-name', 'Optional name just for this mode', displayName, length: 60),
        editField('p02-bio', 'Short bio (no contact links or numbers)', bio, lines: 3, length: 500),
        editField('p02-intention', 'What are you looking for?', intention, length: 80),
        editField('p02-interests', 'Interests, comma-separated (up to 10)', interests),
        const SizedBox(height: 12),
        Text('Still needed for future discovery activation: ${dashboard!.profiles[mode]!.missing.join(', ')}',
          key: const Key('p02-missing')),
        const SizedBox(height: 10),
        FilledButton(key: const Key('p02-save-draft'), onPressed: busy ? null : saveDraft,
          child: const Text('Save mode details')),
        const SizedBox(height: 20),
        Text('4 · Continue', style: Theme.of(context).textTheme.titleMedium),
        if (ready && !commonDirty && !dirty && !handleDirty)
          const Text('Your saved profile setup meets the minimum requirements.'),
        if (!ready || commonDirty || dirty || handleDirty) ...[
          const Text('Complete and save the following before continuing:'),
          for (final item in dashboard!.onboarding.missing)
            Padding(padding: const EdgeInsets.only(top: 4), child: Text('• ${missingLabel(item)}')),
          if (commonDirty || dirty || handleDirty)
            const Text('• Save your current unsaved edits'),
        ],
        const SizedBox(height: 12),
        FilledButton(key: const Key('p02-continue'),
          onPressed: busy || !ready || commonDirty || dirty || handleDirty ? null : () => setState(() => readySummary = true),
          child: const Text('Continue')),
        const SizedBox(height: 12),
        TextButton(key: const Key('p02-reload'), onPressed: busy ? null : load,
          child: const Text('Reload saved profiles')),
        const Text('Profiles stay private until photo requirements and explicit activation are implemented.'),
      ],
    ]);
  }
}
