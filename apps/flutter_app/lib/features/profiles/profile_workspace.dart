import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../design/uluv_design.dart';
import 'profile_models.dart';
import 'profile_service.dart';
import 'profile_media.dart';
import 'profile_photos_panel.dart';

/// An in-place authenticated panel. Unlike a pushed route, it is immediately
/// destroyed when PersistentAuthGate hides the account after logout/revocation.
class ProfileWorkspace extends StatefulWidget {
  const ProfileWorkspace({super.key, required this.repository, this.initiallyExpanded = false,
    this.onDashboardConfirmed, this.summaryOnReady = false,
    this.compactSummary = false});
  final bool initiallyExpanded;
  final ProfileRepository repository;
  /// Derived only from authenticated Fastify /v1/profiles/me. Never optimistic.
  final ValueChanged<ProfileDashboard>? onDashboardConfirmed;
  final bool summaryOnReady;
  /// Compact owner profile surface when embedded inside Settings.
  final bool compactSummary;
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
  final Map<String, ({String name, String bio, String interests,
      String intention, bool unsaved})> modeEdits = {};
  bool expanded = false, busy = false, dirty = false;
  bool profileReadAttempted = false;
  String activeStep = 'common';
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
    if (mode != next) {
      // Preserve an unsaved draft when stepping backwards through other modes.
      modeEdits[mode] = (name: displayName.text, bio: bio.text,
        interests: interests.text, intention: intention.text, unsaved: dirty);
    }
    mode = next;
    final pending = modeEdits[next];
    final profile = dashboard?.profiles[next];
    displayName.text = pending?.unsaved == true
        ? pending!.name : (profile?.displayName ?? '');
    bio.text = pending?.unsaved == true
        ? pending!.bio : (profile?.bio ?? '');
    interests.text = pending?.unsaved == true
        ? pending!.interests : (profile?.interests.join(', ') ?? '');
    intention.text = pending?.unsaved == true
        ? pending!.intention : (profile?.intention ?? '');
    dirty = pending?.unsaved == true;
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
      // A 2xx response is insufficient if the returned owner projection does
      // not reflect the exact change. Never display a false 'saved' message.
      // Backend trims user-entered fields before persistence.
      final confirmed = result.value!.shared;
      if (confirmed.commonName != commonName.text.trim() ||
          confirmed.locality != locality.text.trim() ||
          confirmed.gender != gender || confirmed.dating != datingEnabled ||
          confirmed.friendship != friendshipEnabled) {
        setState(() => notice =
            'Saved values could not be confirmed. Reload your profile before retrying.');
        return;
      }
      setState(() {
        dashboard = result.value;
        if (!setupSteps.contains(activeStep)) activeStep = 'common';
        loadCommon();
        // Preserve a mode draft being typed before common details were saved.
        if (!dirty) loadMode(mode);
        notice = 'Common profile saved. Complete each enabled mode to continue.';
      });
      widget.onDashboardConfirmed?.call(result.value!);
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
        if (widget.summaryOnReady && result.value!.onboarding.ready &&
            !commonDirty && !dirty && !handleDirty) readySummary = true;
        notice = 'Saved details and setup status refreshed.';
      });
      widget.onDashboardConfirmed?.call(result.value!);
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
    setState(() { busy = true; profileReadAttempted = true;
      notice = 'Loading your profile drafts...'; });
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
        modeEdits.clear();
        loadMode(mode);
        loadCommon();
        // Always restore the editable profile on launch. Previously, completed
        // onboarding silently switched to the completion screen and concealed
        // persisted city/gender/mode selections from the owner.
        readySummary = widget.summaryOnReady && result.value!.onboarding.ready;
        activeStep = 'common';
        notice = 'Saved profile details loaded from your account.';
      });
      widget.onDashboardConfirmed?.call(result.value!);
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
        modeEdits.remove(mode);
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

  Future<void> changeActivation(String selected, bool value) async {
    final original = dashboard?.profiles[selected];
    if (busy || original == null) return;
    setState(() { busy = true; notice = 'Updating private activation intent...'; });
    try {
      final reply = await widget.repository.setModeActivation(selected, original.version, value);
      if (!mounted) return;
      if (!reply.ok) {
        setState(() => notice = describe(reply.error, reply.status));
        return;
      }
      setState(() {
        dashboard = reply.value;
        notice = value ? 'Activation requested. Profile remains private pending trusted locality.'
            : 'Mode deactivated and private.';
      });
      widget.onDashboardConfirmed?.call(reply.value!);
    } catch (_) {
      if (mounted) setState(() => notice =
          'Activation status could not be confirmed. Reload the saved profile before retrying.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> showOwnerPreview(String selected) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final response = await widget.repository.ownerPreview(selected);
      if (!mounted) return;
      if (!response.ok) {
        setState(() => notice = describe(response.error, response.status));
        return;
      }
      final preview = response.value!;
      final photoIds = (preview['photoIds'] is List ? preview['photoIds'] as List : const [])
          .whereType<String>().take(2).toList(growable: false);
      await showDialog<void>(context: context, builder: (context) => AlertDialog(
        title: Text('Private ${selected == 'dating' ? 'Dating' : 'Friendship'} preview'),
        content: SingleChildScrollView(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min,
          children: [
            Text(preview['displayName']?.toString() ?? ''),
            Text('Age: ${preview['age']} · ${preview['broadArea']}'),
            Text(preview['intention']?.toString() ?? ''),
            Text(preview['bio']?.toString() ?? ''),
            Text((preview['interests'] as List? ?? const []).join(', ')),
            Wrap(key: const Key('p02-private-preview-photos'),
              spacing: 8, runSpacing: 8,
              children: [for (final id in photoIds) reviewPhoto(id)]),
            const Text('Private preview — not publicly discoverable.'),
          ],
        )),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ));
    } catch (_) {
      if (mounted) setState(() => notice =
          'Private preview could not be loaded. Check your connection and try again.');
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

  String genderLabel(String code) => switch (code) {
    'woman' => 'Woman', 'man' => 'Man', 'non_binary' => 'Non-binary',
    'another_identity' => 'Another identity',
    'prefer_not_to_say' => 'Prefer not to say',
    _ => 'Not saved',
  };

  String selectedModeLabel(SharedProfile shared) {
    if (shared.dating && shared.friendship) return 'Dating and Friendship';
    if (shared.dating) return 'Dating';
    if (shared.friendship) return 'Friendship';
    return 'None';
  }

  /// Enablement is separate from which draft editor is open. Move to the newly
  /// enabled mode if the current one is disabled and has no unsaved text.
  void setModeEnabled(String target, bool enabled) {
    setState(() {
      if (target == 'dating') datingEnabled = enabled;
      else friendshipEnabled = enabled;
      commonDirty = true;
      final currentEnabled = mode == 'dating' ? datingEnabled : friendshipEnabled;
      if (enabled && !currentEnabled && !dirty) loadMode(target);
    });
  }

  String missingLabel(String item) {
    const labels = <String, String>{
      'handle': 'Choose and save your account @handle',
      'ageEligibility': 'Contact support: your saved adult eligibility needs review',
      'commonName': 'Enter your common profile name',
      'locality': 'Enter your broad city/locality (not your address)',
      'gender': 'Choose your gender or explicitly select Prefer not to say',
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
      'dating.photos': 'Assign at least two valid, saved photos to Dating',
      'friendship.photos': 'Assign at least two valid, saved photos to Friendship',
      'photoVerificationPending': 'Confirming saved photo assignments with the server',
    };
    return labels[item] ?? item;
  }

  /// Only saved connection-mode choices determine the available pages.
  /// Unsaved toggles must never add a page or bypass its validation gate.
  List<String> get setupSteps => [
    'common',
    if (dashboard?.shared.dating == true) ...['dating.details', 'dating.photos'],
    if (dashboard?.shared.friendship == true) ...[
      'friendship.details', 'friendship.photos',
    ],
    'review',
  ];

  String stepTitle(String step) => switch (step) {
    'common' => 'Common profile',
    'dating.details' => 'Dating details',
    'dating.photos' => 'Dating photos',
    'friendship.details' => 'Friendship details',
    'friendship.photos' => 'Friendship photos',
    'review' => 'Review your profile',
    _ => 'Profile setup',
  };

  bool get commonSaved {
    final state = dashboard;
    if (state == null || commonDirty || handleDirty || hasPendingHandle) {
      return false;
    }
    final shared = state.shared;
    if (state.handle == null || state.handle!.isEmpty ||
        shared.setupRevision < 1 || shared.commonName.trim().isEmpty ||
        shared.locality.trim().isEmpty || shared.gender.isEmpty ||
        (!shared.dating && !shared.friendship)) return false;
    return !state.onboarding.missing.any((item) => const {
      'handle', 'ageEligibility', 'commonName', 'locality',
      'gender', 'selectMode',
    }.contains(item));
  }

  bool stepSaved(String step) {
    final state = dashboard;
    if (state == null || busy) return false;
    if (step == 'common') return commonSaved;
    if (step == 'review') return state.onboarding.ready &&
        !commonDirty && !handleDirty && !dirty;
    final profileMode = step.split('.').first;
    if (!commonSaved || (profileMode == 'dating'
        ? !state.shared.dating : !state.shared.friendship)) return false;
    final profile = state.profiles[profileMode];
    if (profile == null || !profile.exists) return false;
    final missing = state.onboarding.missing;
    if (step.endsWith('.details')) {
      if (mode == profileMode && dirty) return false;
      return !missing.any((item) => item == '$profileMode.draft' ||
          item == '$profileMode.bio' || item == '$profileMode.intention' ||
          item == '$profileMode.interests' ||
          item == '$profileMode.displayName');
    }
    // The backend, not the Flutter photo count, confirms READY/owned media.
    // Never advance on a stale status while a media write is being verified.
    return profile.photoIds.toSet().length >= 2 &&
        !missing.contains('$profileMode.photos') &&
        !missing.contains('photoVerificationPending');
  }

  void stepTo(int index) {
    final steps = setupSteps;
    final current = steps.indexOf(activeStep);
    if (busy || current < 0 || index < 0 || index >= steps.length) return;
    if (index > current && (index != current + 1 || !stepSaved(activeStep))) {
      setState(() => notice = 'Complete and save this step before continuing.');
      return;
    }
    if (index == current) return;
    final next = steps[index];
    setState(() {
      activeStep = next;
      readySummary = false;
      notice = '';
      if (next == 'dating.details' || next == 'dating.photos' ||
          next == 'friendship.details' || next == 'friendship.photos') {
        final nextMode = next.split('.').first;
        // Mode controllers must not be reloaded while they contain edits.
        if (mode != nextMode) loadMode(nextMode);
      }
    });
  }

  /// One deliberate action: validate, persist the current step, await the
  /// authoritative server projection, then navigate. Never skip a failed save.
  Future<void> saveAndNext() async {
    if (busy || dashboard == null || activeStep == 'review') return;
    final current = activeStep;
    if (current == 'common') {
      if (handle.text.trim().isEmpty || commonName.text.trim().isEmpty ||
          locality.text.trim().isEmpty || gender.isEmpty ||
          (!datingEnabled && !friendshipEnabled)) {
        setState(() => notice = 'Complete username, name, city, gender and enable at least one mode.');
        return;
      }
      if (hasPendingHandle) {
        await saveHandle();
        if (!mounted || dashboard == null || hasPendingHandle || handleDirty) return;
      }
      if (commonDirty) {
        await saveCommon();
        if (!mounted || dashboard == null || commonDirty) return;
      }
    } else if (current.endsWith('.details')) {
      final selected = current.split('.').first;
      final previous = dashboard!.profiles[selected];
      // Avoid a redundant write if the saved mode is complete and unchanged.
      if (dirty || previous?.exists != true || !stepSaved(current)) {
        await saveDraft();
        if (!mounted || dashboard == null || dirty) return;
      }
    } else if (current.endsWith('.photos')) {
      // Upload and assignment are persisted separately by the media panel.
      // A fresh server read is required before crossing the photo gate.
      await refreshAfterDraftSave(preserveEditors: true);
    }
    if (!mounted) return;
    if (!stepSaved(current)) {
      setState(() => notice = 'The saved step is incomplete. Review the red requirements and try again.');
      return;
    }
    stepTo(setupSteps.indexOf(current) + 1);
  }

  void swipeStep(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (velocity.abs() < 250) return;
    final current = setupSteps.indexOf(activeStep);
    if (velocity < 0) stepTo(current + 1);
    if (velocity > 0) stepTo(current - 1);
  }

  Widget warning(String message, {Key? key}) => Text(message, key: key,
    style: TextStyle(color: Theme.of(context).colorScheme.error,
      fontWeight: FontWeight.w700, height: 1.35),
  );

  bool get noticeIsWarning => RegExp(
    r'failed|not |could not|cannot|check|error|unsaved|review|missing|complete and save|unavailable|denied|conflict|already in use',
    caseSensitive: false,
  ).hasMatch(notice);

  Widget commonPage() => Column(
    key: const ValueKey('p02-page-common'),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const UluvStageBanner(
        title: 'The real you, first',
        subtitle: 'One shared identity. Your Dating and Friendship stories stay separate.',
        icon: Icons.person_outline_rounded,
      ),
      const SizedBox(height: 14),
      const Text('Shared by Dating and Friendship. Complete and save your '
        'public handle, name, broad city, gender selection and at least one mode.'),
      const SizedBox(height: 12),
      TextField(key: const Key('p02-handle'), controller: handle, enabled: !busy,
        onChanged: (_) => setState(() {
          handleDirty = handle.text.trim().replaceFirst(RegExp(r'^@'), '').toLowerCase() !=
              (dashboard?.handle ?? '');
          handleError = '';
        }),
        maxLength: 24, decoration: const InputDecoration(
          labelText: 'Public username / @handle *', prefixText: '@',
          border: OutlineInputBorder(), helperText: 'One unique handle for both modes.'),
      ),
      if (handleError.isNotEmpty) warning(handleError,
        key: const Key('p02-handle-error')),
      Padding(padding: const EdgeInsets.only(top: 12), child: TextField(
        key: const Key('p02-common-name'), controller: commonName, maxLength: 60,
        enabled: !busy, onChanged: (_) => setState(() => commonDirty = true),
        decoration: const InputDecoration(labelText: 'Display name *',
          border: OutlineInputBorder()),
      )),
      const SizedBox(height: 12),
      TextField(key: const Key('p02-locality'), controller: locality, maxLength: 60,
        enabled: !busy, onChanged: (_) => setState(() => commonDirty = true),
        decoration: const InputDecoration(labelText: 'City or broad locality *',
          helperText: 'Example: Hyderabad. No street address, GPS or postal code.',
          border: OutlineInputBorder()),
      ),
      const SizedBox(height: 8),
      Text('Age: ${dashboard!.shared.age?.toString() ?? 'unavailable'} '
        '(calculated from the date of birth supplied at signup)'),
      const SizedBox(height: 12),
      InputDecorator(decoration: const InputDecoration(
        labelText: 'Gender *', border: OutlineInputBorder()),
        child: DropdownButtonHideUnderline(child: DropdownButton<String>(
          key: const Key('p02-gender'), value: gender, isExpanded: true,
          items: const [
            DropdownMenuItem(value: '', child: Text('Select an answer')),
            DropdownMenuItem(value: 'woman', child: Text('Woman')),
            DropdownMenuItem(value: 'man', child: Text('Man')),
            DropdownMenuItem(value: 'non_binary', child: Text('Non-binary')),
            DropdownMenuItem(value: 'another_identity', child: Text('Another identity')),
            DropdownMenuItem(value: 'prefer_not_to_say', child: Text('Prefer not to say')),
          ],
          onChanged: busy ? null : (value) => setState(() {
            gender = value ?? ''; commonDirty = true;
          }),
        )),
      ),
      const SizedBox(height: 18),
      Text('Connection modes', style: Theme.of(context).textTheme.titleMedium),
      const Text('Enable Dating, Friendship, or both. This does not activate '
        'public discovery.'),
      const SizedBox(height: 10),
      UluvSectionCard(tint: UluvPalette.pinkTint,
        padding: EdgeInsets.zero,
        child: SwitchListTile(key: const Key('p02-enable-dating'),
          secondary: const Icon(Icons.favorite_border_rounded,
            color: UluvPalette.pinkAction),
          title: const Text('Enable Dating',
            style: TextStyle(fontWeight: FontWeight.w700)),
          subtitle: const Text('Romantic connections'),
          value: datingEnabled,
          onChanged: busy ? null : (value) => setModeEnabled('dating', value))),
      const SizedBox(height: 10),
      UluvSectionCard(tint: UluvPalette.tealTint,
        padding: EdgeInsets.zero,
        child: SwitchListTile(key: const Key('p02-enable-friendship'),
          secondary: const Icon(Icons.people_outline_rounded,
            color: UluvPalette.teal),
          title: const Text('Enable Friendship',
            style: TextStyle(fontWeight: FontWeight.w700)),
          subtitle: const Text('Platonic friendships'),
          value: friendshipEnabled,
          onChanged: busy ? null : (value) => setModeEnabled('friendship', value))),
      const SizedBox(height: 10),
      if (commonDirty || handleDirty || hasPendingHandle)
        warning('Unsaved common details do not unlock the next step.',
          key: const Key('p02-common-unsaved')),
    ],
  );

  Widget modePage(String selected) => Column(
    key: ValueKey('p02-page-$selected-details'),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      UluvStageBanner(
        title: selected == 'dating' ? 'Your Dating story' : 'Your Friendship story',
        subtitle: selected == 'dating'
          ? 'Share what makes a meaningful connection for you.'
          : 'A few interests can spark a great friendship.',
        icon: selected == 'dating'
          ? Icons.favorite_border_rounded : Icons.people_outline_rounded,
        friendship: selected == 'friendship',
      ),
      const SizedBox(height: 14),
      const Text('A separate nickname is optional; your common name is used if blank. '
        'Bio, intention and at least one interest must be saved.'),
      const SizedBox(height: 10),
      Text(dashboard!.profiles[selected]!.exists
          ? 'Your saved draft stays private. Save & Next confirms any new edits.'
          : 'New private draft · complete the fields, then choose Save & Next.',
        style: Theme.of(context).textTheme.bodySmall),
      editField('p02-name', 'Optional name just for this mode', displayName,
        length: 60),
      editField('p02-bio', 'Short bio (no contact links or numbers)', bio,
        lines: 3, length: 500),
      editField('p02-intention', 'What are you looking for?', intention,
        length: 80),
      editField('p02-interests', 'Interests, comma-separated (up to 10)', interests),
      const SizedBox(height: 12),
      if (dirty) warning('Save these changes to move to photos.'),
      const SizedBox(height: 8),
      const Text('Required mode details are validated by the server.',
        key: const Key('p02-missing')),
    ],
  );

  Widget photosPage(String selected) => Column(
    key: ValueKey('p02-page-$selected-photos'),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      UluvStageBanner(
        title: selected == 'dating' ? 'Show the real you' : 'Faces behind friendships',
        subtitle: 'Add at least two private photos for this mode. Reuse photos safely.',
        icon: Icons.add_photo_alternate_outlined,
        friendship: selected == 'friendship',
      ),
      const SizedBox(height: 14),
      if (widget.repository is ProfileMediaRepository &&
          dashboard!.profiles[selected]!.exists)
        ProfilePhotosPanel(key: ValueKey('p02-photos-$selected'),
          repository: widget.repository as ProfileMediaRepository,
          mode: selected, profile: dashboard!.profiles[selected]!,
          onUpdated: (updated) {
            if (!mounted || dashboard == null) return;
            setState(() {
              final previous = dashboard!;
              previous.profiles[updated.mode] = updated;
              dashboard = ProfileDashboard(
                handle: previous.handle, identityRevision: previous.identityRevision,
                locality: previous.locality, profiles: previous.profiles,
                shared: previous.shared,
                onboarding: const OnboardingStatus(
                  ready: false, missing: ['photoVerificationPending']),
              );
              notice = 'Photo assignment saved. Verifying setup requirements...';
            });
            // Require a fresh backend verification before advancing.
            refreshAfterDraftSave(preserveEditors: true);
          },
        )
      else warning('Photo upload requires a saved draft and an available '
        'private media service.'),
    ],
  );

  String stepWarning(String step) {
    final required = dashboard?.onboarding.missing ?? const <String>[];
    final selected = required.where((item) {
      if (step == 'common') return const {
        'handle', 'ageEligibility', 'commonName', 'locality',
        'gender', 'selectMode',
      }.contains(item);
      final prefix = step.split('.').first;
      if (step.endsWith('.details')) return item.startsWith('$prefix.') &&
          item != '$prefix.photos';
      return item == '$prefix.photos' || item == 'photoVerificationPending';
    }).map(missingLabel).toList();
    if (step == 'common' && (commonDirty || handleDirty || hasPendingHandle)) {
      selected.insert(0, 'Save all common-profile changes');
    } else if (step.endsWith('.details') && dirty) {
      selected.insert(0, 'Save the current mode draft');
    }
    if (selected.isEmpty) return 'Complete and save this step before proceeding.';
    return 'Required before Save & Next: ${selected.join('; ')}';
  }

  Widget reviewPhoto(String mediaId) {
    // The owner repository implements profile CRUD; media reads are a separate
    // capability. Give the preview an explicitly typed media interface rather
    // than invoking photoBytes on ProfileRepository (which has no such method).
    final repository = widget.repository;
    if (repository is! ProfileMediaRepository) return const SizedBox.shrink();
    final ProfileMediaRepository mediaRepository = repository as ProfileMediaRepository;
    return FutureBuilder<ProfileResult<Uint8List>>(
      future: mediaRepository.photoBytes(mediaId),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data?.ok != true) {
          return const SizedBox(width: 68, height: 68,
            child: Icon(Icons.image_outlined));
        }
        return ClipRRect(borderRadius: BorderRadius.circular(12),
          child: Image.memory(snapshot.data!.value!, width: 68, height: 68,
            fit: BoxFit.cover, errorBuilder: (_, __, ___) =>
              const Icon(Icons.broken_image_outlined)));
      },
    );
  }

  Widget reviewPage() {
    final state = dashboard!;
    return Column(key: const ValueKey('p02-page-review'),
      crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const UluvStageBanner(
        title: 'Your story, all together',
        subtitle: 'Review what you saved before requesting private activation.',
        icon: Icons.fact_check_outlined,
      ),
      const SizedBox(height: 14),
      Text('Review your saved details',
        style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      UluvSectionCard(tint: UluvPalette.blush,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Username: @${state.handle ?? ''}'),
            const SizedBox(height: 5),
            Text('Display name: ${state.shared.commonName}'),
            const SizedBox(height: 5),
            Text('Age: ${state.shared.age?.toString() ?? 'unavailable'}'),
            const SizedBox(height: 5),
            Text('City: ${state.shared.locality}'),
            const SizedBox(height: 5),
            Text('Gender: ${genderLabel(state.shared.gender)}'),
            const SizedBox(height: 5),
            Text('Enabled modes: ${selectedModeLabel(state.shared)}'),
          ],
        ),
      ),
      const Divider(height: 30),
      for (final selected in ['dating', 'friendship'])
        if (selected == 'dating' ? state.shared.dating : state.shared.friendship) ...[
          UluvStageBanner(
            title: selected == 'dating' ? 'Dating' : 'Friendship',
            subtitle: selected == 'dating'
              ? 'Your romantic-connection introduction'
              : 'Your platonic-connection introduction',
            icon: selected == 'dating'
              ? Icons.favorite_border_rounded : Icons.people_outline_rounded,
            friendship: selected == 'friendship',
          ),
          const SizedBox(height: 10),
          UluvSectionCard(
            tint: selected == 'dating' ? UluvPalette.pinkTint : UluvPalette.tealTint,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Name: ${state.profiles[selected]!.displayName.isEmpty
                    ? state.shared.commonName : state.profiles[selected]!.displayName}'),
                const SizedBox(height: 5),
                Text('Bio: ${state.profiles[selected]!.bio}'),
                const SizedBox(height: 5),
                Text('Intention: ${state.profiles[selected]!.intention}'),
                const SizedBox(height: 5),
                Text('Interests: ${state.profiles[selected]!.interests.join(', ')}'),
                const SizedBox(height: 5),
                Text('Photos: ${state.profiles[selected]!.photoIds.length}/6'),
                const SizedBox(height: 9),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final id in state.profiles[selected]!.photoIds) reviewPhoto(id),
                ]),
              ],
            ),
          ),
          const Divider(height: 30),
        ],
      const UluvStatusNotice(message: 'These details and photos are saved privately. Public '
        'discovery activation is a separate P02-3 step.'),
      const SizedBox(height: 12),
      FilledButton(key: const Key('p02-continue'),
        onPressed: busy || !stepSaved('review') ? null : () =>
            setState(() => readySummary = true),
        child: const Text('Continue')),
    ]);
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
    // Do not flash the first-time profile wizard while an existing owner's
    // authoritative dashboard is still being loaded.
    if (widget.summaryOnReady && dashboard == null) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(profileReadAttempted && !busy
          ? 'Could not check your saved profile.'
          : 'Checking your saved profile…',
          key: const Key('p03-profile-restore-status')),
        if (busy) const LinearProgressIndicator(),
        if (profileReadAttempted && !busy)
          OutlinedButton(key: const Key('p02-load-retry'),
            onPressed: () => load(first: true),
            child: const Text('Retry loading profiles')),
      ]);
    }
    final ready = dashboard?.onboarding.ready == true;
    if (ready && readySummary && widget.compactSummary) {
      final shared = dashboard!.shared;
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ListTile(
          key: const Key('p03-settings-profile-summary'),
          contentPadding: EdgeInsets.zero,
          leading: const CircleAvatar(child: Icon(Icons.person_outline)),
          title: Text(shared.commonName.isEmpty ? 'My profile' : shared.commonName,
            key: const Key('p02-setup-ready'),
            style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(dashboard!.handle?.isNotEmpty == true
              ? '@${dashboard!.handle}' : 'Your account'),
          trailing: TextButton.icon(
            key: const Key('p03-settings-edit-profile'),
            onPressed: busy ? null : () => setState(() {
              readySummary = false;
              activeStep = 'review';
            }),
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Edit'),
          ),
        ),
        ExpansionTile(
          key: const PageStorageKey<String>('p03-profile-visibility-expansion'),
          tilePadding: EdgeInsets.zero,
          title: const Text('Profiles & visibility'),
          children: [
            for (final selected in ['dating', 'friendship'])
              if ((selected == 'dating' ? shared.dating : shared.friendship) &&
                  dashboard!.profiles[selected] != null)
                Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  SwitchListTile(
                    key: Key('p02-activate-$selected'),
                    contentPadding: EdgeInsets.zero,
                    title: Text(selected == 'dating' ? 'Dating' : 'Friendship'),
                    subtitle: Text('Status: ${dashboard!.profiles[selected]!.visibility}'),
                    value: dashboard!.profiles[selected]!.requestedActive,
                    onChanged: busy ? null : (value) => changeActivation(selected, value),
                  ),
                  if (dashboard!.profiles[selected]!.activationMissing.isNotEmpty)
                    Text('Not eligible: ${dashboard!.profiles[selected]!.activationMissing.join(', ')}'),
                  Align(alignment: Alignment.centerLeft,
                    child: TextButton(
                      key: Key('p02-owner-preview-$selected'),
                      onPressed: busy ? null : () => showOwnerPreview(selected),
                      child: const Text('Preview profile'),
                    )),
                ]),
          ],
        ),
      ]);
    }
    if (ready && readySummary) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const UluvStageBanner(title: 'You are all set',
          subtitle: 'Your saved profile is ready for private activation requests.',
          icon: Icons.check_circle_outline),
        const SizedBox(height: 12),
        Text('Profile setup complete',
          style: Theme.of(context).textTheme.titleLarge,
          key: const Key('p02-setup-ready')),
        const Text('Your common profile and every enabled mode meet the '
          'onboarding requirements.'),
        const Text('Your profile remains private until you explicitly '
          'enable discovery after trusted locality and visibility checks are implemented.'),
        const SizedBox(height: 16),
        for (final selected in ['dating', 'friendship'])
          if (selected == 'dating' ? dashboard!.shared.dating : dashboard!.shared.friendship)
            Card(color: selected == 'dating' ? UluvPalette.pinkTint : UluvPalette.tealTint,
              child: Padding(padding: const EdgeInsets.all(14), child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${selected == 'dating' ? 'Dating' : 'Friendship'} activation',
                style: Theme.of(context).textTheme.titleMedium),
              Text('Status: ${dashboard!.profiles[selected]!.visibility}'),
              if (dashboard!.profiles[selected]!.visibility == 'paused_ineligible')
                warning('Activation is paused after profile changes. Turn it off, '
                  'review the saved requirements, then request activation again.'),
              if (dashboard!.profiles[selected]!.activationMissing.isNotEmpty)
                warning('Cannot activate: ${dashboard!.profiles[selected]!.activationMissing.join(', ')}'),
              SwitchListTile(
                key: Key('p02-activate-$selected'),
                title: const Text('Request activation'),
                subtitle: const Text('Remains private until verified locality and P03 discovery are available.'),
                value: dashboard!.profiles[selected]!.requestedActive,
                onChanged: busy ? null : (value) => changeActivation(selected, value),
              ),
              FilledButton.tonal(key: Key('p02-owner-preview-$selected'),
                onPressed: busy ? null : () => showOwnerPreview(selected),
                child: const Text('Preview safe profile')),
            ]))),
        const SizedBox(height: 16),
        FilledButton.tonal(key: const Key('p02-edit-setup'),
          onPressed: () => setState(() {
            readySummary = false;
            activeStep = 'review';
          }), child: const Text('Edit profile details')),
        TextButton(key: const Key('p02-ready-reload'),
          onPressed: busy ? null : () async {
            setState(() => readySummary = false);
            await load(first: true);
          }, child: const Text('Refresh saved setup status')),
      ]);
    }
    final steps = setupSteps;
    final current = steps.contains(activeStep) ? steps.indexOf(activeStep) : 0;
    final step = steps[current];
    final currentComplete = dashboard != null && stepSaved(step);
    final activeAccent = step.startsWith('friendship')
      ? UluvPalette.teal : UluvPalette.pinkAction;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Set up your profile', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 6),
      Text('Step ${current + 1} of ${steps.length} · ${stepTitle(step)}',
        key: const Key('p02-step-label'),
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          color: UluvPalette.ink, fontWeight: FontWeight.w800)),
      const SizedBox(height: 12),
      Row(children: [for (var i = 0; i < steps.length; i++)
        Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Container(height: 5, decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: i <= current ? activeAccent
                : Theme.of(context).colorScheme.outlineVariant,
          )),
        )),
      ]),
      const SizedBox(height: 10),
      SizedBox(height: 44, child: ListView(scrollDirection: Axis.horizontal,
        children: [for (var i = 0; i < steps.length; i++)
          Padding(padding: const EdgeInsets.only(right: 6),
            child: ChoiceChip(
              key: Key('p02-step-tab-$i'),
              label: Text(stepTitle(steps[i])), selected: i == current,
              selectedColor: steps[i].startsWith('friendship')
                ? UluvPalette.tealTint : UluvPalette.pinkTint,
              onSelected: busy || (i > current &&
                  (i != current + 1 || !currentComplete))
                  ? null : (_) => stepTo(i),
            ),
          ),
        ],
      )),
      const SizedBox(height: 6),
      Text('Swipe to revisit steps. Moving forward requires saved, verified details.',
        style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      if (busy) const LinearProgressIndicator(key: Key('p02-progress')),
      if (notice.isNotEmpty) Semantics(liveRegion: true,
        child: noticeIsWarning
          ? warning(notice, key: const Key('p02-notice'))
          : Text(notice, key: const Key('p02-notice'))),
      const SizedBox(height: 10),
      if (dashboard == null)
        OutlinedButton(key: const Key('p02-load-retry'),
          onPressed: busy ? null : () => load(first: true),
          child: const Text('Retry loading profiles'))
      else ...[
        GestureDetector(
          key: const Key('p02-swipe-region'),
          behavior: HitTestBehavior.translucent,
          onHorizontalDragEnd: swipeStep,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            // Do not keep outgoing editors mounted: both mode pages reuse
            // controllers, so overlapping text fields could show wrong data.
            layoutBuilder: (currentChild, previousChildren) =>
                currentChild ?? const SizedBox.shrink(),
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween<Offset>(begin: const Offset(0.035, 0),
                  end: Offset.zero).animate(animation), child: child)),
            child: switch (step) {
              'common' => commonPage(),
              'dating.details' => modePage('dating'),
              'dating.photos' => photosPage('dating'),
              'friendship.details' => modePage('friendship'),
              'friendship.photos' => photosPage('friendship'),
              _ => reviewPage(),
            },
          ),
        ),
        if (step != 'review' && !currentComplete)
          Padding(padding: const EdgeInsets.only(top: 12),
            child: warning(stepWarning(step),
              key: const Key('p02-step-warning'))),
        if (step != 'review' && currentComplete)
          const Padding(padding: EdgeInsets.only(top: 12),
            child: UluvStatusNotice(
              message: 'Saved and verified. You can continue.')),
        const SizedBox(height: 14),
        Row(children: [
          if (current > 0) Expanded(child: OutlinedButton(
            key: const Key('p02-back'),
            onPressed: busy ? null : () => stepTo(current - 1),
            child: const Text('Back'))),
          if (current > 0) const SizedBox(width: 10),
          if (step != 'review') Expanded(child: FilledButton(
            key: const Key('p02-save-next'),
            style: step.startsWith('friendship')
              ? FilledButton.styleFrom(backgroundColor: UluvPalette.teal)
              : null,
            onPressed: busy ? null : saveAndNext,
            child: const Text('Save & Next'))),
        ]),
        const SizedBox(height: 8),
        TextButton(key: const Key('p02-reload'),
          onPressed: busy ? null : load,
          child: const Text('Reload saved profiles')),
      ],
    ]);
  }
}
