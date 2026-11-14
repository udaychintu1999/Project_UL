import 'dart:convert';
import 'package:flutter/material.dart';
import 'auth_service.dart';

/// P01-2: distinct login, registration, password recovery, and account pages.
/// P01-3 alone will persist credentials/renew sessions across app restarts.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.service});
  final AuthService service;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final email = TextEditingController();
  final code = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  final currentPassword = TextEditingController();
  final newPassword = TextEditingController();
  final recoveryCode = TextEditingController();

  bool busy = false;
  bool consent = false;
  bool codeRequested = false;
  bool recoveryRequested = false;
  bool showPassword = false;
  DateTime? dob;
  String message = 'Log in with your email and password.';
  String? token, uid, localCode, recoveryLocalCode;
  String mode = 'password'; // password | signup | otp | recovery
  String accountPanel = 'home'; // home | setup | options | create | change
  bool? passwordConfigured; // unknown for an existing account reached by OTP
  final Set<String> touched = <String>{}; // local guidance, never an authorization gate

  SignupPasswordAuthService? get registration => widget.service is SignupPasswordAuthService
      ? widget.service as SignupPasswordAuthService : null;

  PasswordAuthService? get passwords => widget.service is PasswordAuthService
      ? widget.service as PasswordAuthService
      : null;

  @override
  void initState() {
    super.initState();
    if (passwords == null) mode = 'otp';
  }

  @override
  void dispose() {
    for (final controller in [email, code, password, confirm, currentPassword,
      newPassword, recoveryCode]) {
      controller.dispose();
    }
    super.dispose();
  }

  void chooseMode(String next) {
    if (busy) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      mode = next;
      touched.clear();
      message = 'Ready.';
      codeRequested = false;
      localCode = null;
      recoveryRequested = false;
      recoveryLocalCode = null;
      code.clear();
      recoveryCode.clear();
      password.clear();
      confirm.clear();
      currentPassword.clear();
      newPassword.clear();
      dob = null;
      consent = false;
    });
  }

  void chooseAccountPanel(String next) {
    if (busy) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      accountPanel = next;
      touched.clear();
      message = next == 'home' ? 'Account ready.' : 'Manage your password.';
      password.clear();
      confirm.clear();
      currentPassword.clear();
      newPassword.clear();
    });
  }

  // Per-field feedback: the backend remains authoritative for rate limits,
  // eligibility, compromised passwords and every authentication decision.
  String? fieldError(String key) {
    switch (key) {
      case 'auth-email':
        final value = email.text.trim().toLowerCase();
        if (value.isEmpty) return 'Enter your email address.';
        if (value.length > 254 || value.contains('..') ||
            !RegExp(r"^[a-z0-9.!#\$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$")
                .hasMatch(value)) {
          return 'Enter a valid email address.';
        }
        return null;
      case 'auth-password':
      case 'auth-current-password':
        return (key == 'auth-password' ? password.text : currentPassword.text).isEmpty
            ? 'Enter your password.' : null;
      case 'auth-create-password':
      case 'auth-new-password':
      case 'auth-recovery-password':
        final value = key == 'auth-create-password' ? password.text
            : key == 'auth-new-password' ? newPassword.text : newPassword.text;
        final length = value.runes.length;
        if (length < 15) return '$length/15 characters — add ${15 - length} more.';
        if (length > 256 || utf8.encode(value).length > 1024 || RegExp(r'[\x00-\x1F\x7F]').hasMatch(value)) {
          return 'Choose a shorter password without control characters.';
        }
        return null;
      case 'auth-confirm-password':
      case 'auth-recovery-confirm':
        final target = key == 'auth-confirm-password' ? password.text : newPassword.text;
        if (confirm.text.isEmpty) return 'Confirm your password.';
        return confirm.text == target ? null : "Passwords don't match.";
      case 'auth-code':
      case 'auth-recovery-code':
        final value = key == 'auth-code' ? code.text : recoveryCode.text;
        return RegExp(r'^\d{6}$').hasMatch(value) ? null : 'Enter all six digits.';
      case 'auth-dob':
        if (dob == null) return 'Select your date of birth.';
        final today = DateTime.now();
        final eighteenth = DateTime(today.year - 18,today.month,today.day);
        return dob!.isAfter(eighteenth) ? 'You must be at least 18 years old.' : null;
      case 'auth-consent':
        return consent ? null : 'Confirm your date of birth and registration consent.';
    }
    return null;
  }

  void touchedField(String field) => setState(() => touched.add(field));
  bool validate(List<String> fields) {
    setState(() => touched.addAll(fields));
    return fields.every((field) => fieldError(field) == null);
  }
  Widget inlineError(String key) {
    final error = touched.contains(key) ? fieldError(key) : null;
    return error == null ? const SizedBox.shrink() : Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 8),
      child: Semantics(liveRegion:true, child: Text(error,
          key: Key('$key-error'),style: const TextStyle(color: Colors.red))),
    );
  }

  Future<void> run(Future<AuthResult> Function() task, {String action = ''}) async {
    if (busy) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {busy = true; message = 'Working...';});
    try {
      final result = await task();
      if (!mounted) return;
      setState(() {
        message = result.message;
        if (result.ok && action == 'request') {
          codeRequested = true;
          localCode = null;
        }
        if (result.ok && action == 'outbox') localCode = result.code;
        if (result.ok && action == 'recovery-request') {
          recoveryRequested = true;
          recoveryLocalCode = null;
        }
        if (result.ok && action == 'recovery-outbox') recoveryLocalCode = result.code;
        if (result.ok && (action == 'verify' || action == 'signup' || action == 'password-login')) {
          token = result.token;
          uid = result.uniqueId;
          passwordConfigured = action == 'password-login' || action == 'signup' ? true : null;
          // New users are invited to create a password; returning users go
          // straight to their account without any password editing form.
          accountPanel = 'home';
          code.clear();
          password.clear();
          confirm.clear();
          localCode = null;
        }
        if (result.ok && action == 'me') uid = result.uniqueId;
        if (result.ok && (action == 'logout' || action == 'password-change' ||
            action == 'password-reset')) {
          token = null;
          uid = null;
          passwordConfigured = null;
          accountPanel = 'home';
          codeRequested = false;
          localCode = null;
          recoveryRequested = false;
          recoveryLocalCode = null;
          password.clear();
          newPassword.clear();
          currentPassword.clear();
          confirm.clear();
          recoveryCode.clear();
          mode = passwords == null ? 'otp' : 'password';
        }
        if (result.ok && action == 'password-set') {
          passwordConfigured = true;
          accountPanel = 'home';
          password.clear();
          confirm.clear();
        }
        if (!result.ok && action == 'me' && result.message.startsWith('Session expired')) {
          token = null;
          uid = null;
          accountPanel = 'home';
        }
      });
    } catch (_) {
      if (mounted) setState(() => message = 'Unexpected error. Retry.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> chooseDate() async {
    final now = DateTime.now();
    final chosen = await showDatePicker(
      context: context,
      initialDate: dob ?? DateTime(now.year - 19, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Select your date of birth',
    );
    if (mounted && chosen != null) setState(() {dob = chosen;touched.add('auth-dob');});
  }

  String formattedDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Widget emailField() => TextField(
    key: const Key('auth-email'),
    controller: email,
    enabled: !busy,
    autofillHints: const [AutofillHints.email],
    keyboardType: TextInputType.emailAddress,
    textInputAction: TextInputAction.next,
    onChanged: (_) => setState(() {
      touched.add('auth-email');
      // Do not display an OTP requested for a previous email address.
      codeRequested = false; localCode = null; code.clear();
      recoveryRequested = false; recoveryLocalCode = null; recoveryCode.clear();
    }),
    decoration: InputDecoration(labelText: 'Email address', border: const OutlineInputBorder(),
      errorText: touched.contains('auth-email') ? fieldError('auth-email') : null),
  );

  Widget passwordField(String label, TextEditingController controller, String fieldKey) => TextField(
    key: Key(fieldKey),
    controller: controller,
    enabled: !busy,
    obscureText: !showPassword,
    autocorrect: false,
    enableSuggestions: false,
    autofillHints: const [AutofillHints.password],
    onChanged: (_) => touchedField(fieldKey),
    decoration: InputDecoration(
      errorText: touched.contains(fieldKey) ? fieldError(fieldKey) : null,
      labelText: label,
      border: const OutlineInputBorder(),
      suffixIcon: IconButton(
        onPressed: () => setState(() => showPassword = !showPassword),
        tooltip: showPassword ? 'Hide password' : 'Show password',
        icon: Icon(showPassword ? Icons.visibility_off : Icons.visibility),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => PopScope(
    // P01-2: authenticated Back must not reveal the P00 diagnostics buttons.
    // P01-3 will handle app-restart persistence separately.
    canPop: token == null,
    child: Scaffold(
    appBar: AppBar(automaticallyImplyLeading: token == null, title: Text(token != null ? 'U_luv · Account'
      : mode == 'signup' ? 'U_luv · Sign up'
      : mode == 'otp' ? 'U_luv · Email code login'
      : mode == 'recovery' ? 'U_luv · Recover password' : 'U_luv · Log in')),
    body: SafeArea(child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Center(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(token != null ? 'Your account' : mode == 'signup' ? 'Create your account'
              : mode == 'otp' ? 'Log in with email code'
              : mode == 'recovery' ? 'Reset your password' : 'Welcome to U_luv',
              key: const Key('auth-heading'),
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const Text('Local development: verification codes are in the private test outbox, not sent by email.'),
          const SizedBox(height: 16),
          if (token == null) ...[
            if (passwords != null) ...[
              Wrap(spacing: 8, runSpacing: 6, children: [
                ChoiceChip(key: const Key('auth-mode-password'), label: const Text('Log in'),
                    selected: mode == 'password', onSelected: busy ? null : (_) => chooseMode('password')),
                ChoiceChip(key: const Key('auth-mode-signup'), label: const Text('Sign up'),
                    selected: mode == 'signup', onSelected: busy ? null : (_) => chooseMode('signup')),
                ChoiceChip(key: const Key('auth-mode-otp'), label: const Text('Email code'),
                    selected: mode == 'otp', onSelected: busy ? null : (_) => chooseMode('otp')),
                ChoiceChip(key: const Key('auth-mode-recovery'), label: const Text('Forgot password'),
                    selected: mode == 'recovery', onSelected: busy ? null : (_) => chooseMode('recovery')),
              ]),
              const SizedBox(height: 12),
            ],
            emailField(),
            const SizedBox(height: 10),
            if (mode == 'password' && passwords != null) ...[
              passwordField('Password', password, 'auth-password'),
              const SizedBox(height: 10),
              FilledButton(key: const Key('auth-password-login'),
                onPressed: busy ? null : () => validate(['auth-email','auth-password']) ? run(
                  () => passwords!.passwordLogin(email.text, password.text),
                  action: 'password-login') : null,
                child: const Text('Log in with password')),
              TextButton(onPressed: busy ? null : () => chooseMode('recovery'),
                  child: const Text('Forgot your password?')),
            ],
            if (mode == 'signup' || mode == 'otp') ...[
              Text(mode == 'signup'
                ? 'Verify your email, confirm you are 18 or older, then create a password to register.'
                : 'Sign in using a one-time email code.'),
              const SizedBox(height: 8),
              FilledButton(key: const Key('auth-request'),
                onPressed: busy ? null : () => validate(['auth-email']) ? run(
                  () => mode == 'signup' && registration != null
                    ? registration!.requestSignupCode(email.text) : widget.service.requestCode(email.text), action: 'request') : null,
                child: const Text('Request email code')),
              const Text('A maximum of 5 email codes may be issued per address in 24 hours. If eligible, check for a code. Already registered? Log in.'),
              if (codeRequested) ...[
                const SizedBox(height: 8),
                OutlinedButton(key: const Key('auth-outbox'),
                  onPressed: busy ? null : () => run(
                    () => widget.service.localOutboxCode(email.text), action: 'outbox'),
                  child: const Text('Read local test outbox (development only)')),
                if (localCode != null)
                  SelectableText('Local test code: $localCode', key: const Key('auth-local-code')),
                const SizedBox(height: 10),
                TextField(key: const Key('auth-code'), controller: code, enabled: !busy,
                  keyboardType: TextInputType.number, maxLength: 6,
                  onChanged: (_) => touchedField('auth-code'),
                  decoration: InputDecoration(labelText: '6-digit code', border: const OutlineInputBorder(),
                    errorText: touched.contains('auth-code') ? fieldError('auth-code') : null)),
                if (mode == 'signup') ...[
                  OutlinedButton(key: const Key('auth-dob'),
                    onPressed: busy ? null : () {touchedField('auth-dob');chooseDate();},
                    child: Text(dob == null ? 'Select date of birth' : 'Date of birth: ${formattedDate(dob!)}')),
                  CheckboxListTile(key: const Key('auth-consent'), value: consent,
                    onChanged: busy ? null : (v) => setState(() {consent = v ?? false;touched.add('auth-consent');}),
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text('I confirm that my date of birth is accurate and agree to register.')),
                  inlineError('auth-dob'),
                  inlineError('auth-consent'),
                  const SizedBox(height: 8),
                  passwordField('Create password (15+ characters)', password, 'auth-create-password'),
                  const SizedBox(height: 8),
                  passwordField('Confirm password', confirm, 'auth-confirm-password'),
                  FilledButton(key: const Key('auth-signup-register'),
                    onPressed: busy || registration == null
                      ? null : () => validate(['auth-email','auth-code','auth-dob','auth-consent','auth-create-password','auth-confirm-password'])
                        ? run(() => registration!.registerAccount(email:email.text, code:code.text,
                          dateOfBirth:formattedDate(dob!), consent:consent, password:password.text),action:'signup') : null,
                    child: const Text('Create account')),
                ] else
                  FilledButton(key: const Key('auth-verify'),
                    onPressed: busy || code.text.length != 6
                      ? null : () => validate(['auth-email','auth-code']) ? run(() => widget.service.verify(
                        email: email.text, code: code.text,
                        dateOfBirth: '', consent: false), action: 'verify') : null,
                    child: const Text('Sign in with email code')),

              ],
            ],
            if (mode == 'recovery' && passwords != null) ...[
              const Text('Reset your password with a one-time email recovery code.'),
              FilledButton(key: const Key('auth-recovery-request'),
                onPressed: busy ? null : () => validate(['auth-email']) ? run(
                  () => passwords!.requestPasswordRecovery(email.text), action: 'recovery-request') : null,
                child: const Text('Request recovery code')),
              if (recoveryRequested) ...[
                OutlinedButton(key: const Key('auth-recovery-outbox'),
                  onPressed: busy ? null : () => run(
                    () => passwords!.localPasswordRecoveryCode(email.text), action: 'recovery-outbox'),
                  child: const Text('Read local recovery outbox')),
                if (recoveryLocalCode != null)
                  SelectableText('Local recovery code: $recoveryLocalCode', key: const Key('auth-recovery-local-code')),
                TextField(key: const Key('auth-recovery-code'), controller: recoveryCode,
                  enabled: !busy, maxLength: 6, keyboardType: TextInputType.number,
                  onChanged: (_) => touchedField('auth-recovery-code'),
                  decoration: InputDecoration(labelText: 'Recovery code',
                    errorText: touched.contains('auth-recovery-code') ? fieldError('auth-recovery-code') : null)),
                const SizedBox(height: 8),
                passwordField('New password', newPassword, 'auth-recovery-password'),
                const SizedBox(height: 8),
                passwordField('Confirm new password', confirm, 'auth-recovery-confirm'),
                const SizedBox(height: 8),
                FilledButton(key: const Key('auth-recovery-reset'),
                  onPressed: busy ? null : () => validate(['auth-email','auth-recovery-code','auth-recovery-password','auth-recovery-confirm'])
                    ? run(() => passwords!.resetPassword(email.text, recoveryCode.text, newPassword.text),
                        action: 'password-reset') : null,
                  child: const Text('Reset password')),
              ],
            ],
          ] else ...[
            const Icon(Icons.verified_user_outlined, size: 44),
            Text('Account ID: ${uid ?? 'pending'}', key: const Key('auth-uid')),
            const Text('Account access is limited to eligible adults.'),
            const SizedBox(height: 10),
            if (accountPanel == 'setup' || accountPanel == 'create') ...[
              Text(accountPanel == 'setup'
                  ? 'Add a password to your existing OTP-only account.'
                  : 'Add a password to this verified account.'),
              const SizedBox(height: 8),
              passwordField('Create password', password, 'auth-create-password'),
              const SizedBox(height: 8),
              passwordField('Confirm password', confirm, 'auth-confirm-password'),
              FilledButton(key: const Key('auth-password-set'),
                onPressed: busy ? null : () => validate(['auth-create-password','auth-confirm-password'])
                  ? run(() => passwords!.setPassword(token!, password.text), action: 'password-set') : null,
                child: const Text('Create password')),
              if (accountPanel == 'create') TextButton(
                  key: const Key('auth-password-back'), onPressed: busy ? null : () => chooseAccountPanel('home'),
                  child: const Text('Back to account')),
            ] else if (accountPanel == 'change') ...[
              const Text('Change password'),
              const SizedBox(height: 8),
              passwordField('Current password', currentPassword, 'auth-current-password'),
              const SizedBox(height: 8),
              passwordField('New password', newPassword, 'auth-new-password'),
              FilledButton(key: const Key('auth-password-change'),
                onPressed: busy ? null : () => validate(['auth-current-password','auth-new-password'])
                  ? run(() => passwords!.changePassword(token!, currentPassword.text, newPassword.text),
                      action: 'password-change') : null,
                child: const Text('Change password')),
              TextButton(key: const Key('auth-password-back'),
                  onPressed: busy ? null : () => chooseAccountPanel('home'),
                  child: const Text('Back to account')),
            ] else if (accountPanel == 'options') ...[
              const Text('Choose a password action for this OTP-verified account.'),
              OutlinedButton(key: const Key('auth-open-create-password'),
                onPressed: busy ? null : () => chooseAccountPanel('create'),
                child: const Text('Add password (if not set)')),
              OutlinedButton(key: const Key('auth-open-change-password'),
                onPressed: busy ? null : () => chooseAccountPanel('change'),
                child: const Text('Change existing password')),
              TextButton(key: const Key('auth-password-back'),
                onPressed: busy ? null : () => chooseAccountPanel('home'),
                child: const Text('Back to account')),
            ] else ...[
              FilledButton(key: const Key('auth-me'),
                onPressed: busy ? null : () => run(() => widget.service.me(token!), action: 'me'),
                child: const Text('Check account access')),
              if (passwords != null) OutlinedButton(key: const Key('auth-password-settings'),
                onPressed: busy ? null : () => chooseAccountPanel(
                  passwordConfigured == true ? 'change'
                      : passwordConfigured == false ? 'create' : 'options'),
                child: const Text('Password settings')),
            ],
            const SizedBox(height: 12),
            OutlinedButton(key: const Key('auth-logout'),
              onPressed: busy ? null : () => run(() => widget.service.logout(token!), action: 'logout'),
              child: const Text('Log out')),
          ],
          const SizedBox(height: 12),
          Semantics(liveRegion: true, child: Text(message,
              key: const Key('auth-message'), textAlign: TextAlign.center)),
          if (busy) const Center(child: Padding(
              padding: EdgeInsets.all(12), child: CircularProgressIndicator())),
        ]),
      )),
    )),
    ),
  );
}
