import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/auth_screen.dart';
import 'package:uluv/features/auth/auth_service.dart';

class PasswordFake implements AuthService,PasswordAuthService,SignupPasswordAuthService {
  int logins=0,resets=0,sets=0,signups=0,signupCodeRequests=0,otpLogins=0;
  String? lastOtpEmail,lastOtpCode;
  bool newAccount=true;
  @override Future<AuthResult> passwordLogin(String email,String password)async {logins++;return const AuthResult(ok:true,message:'Signed in with password.',token:'fake-token',uniqueId:'same-uid');}
  @override Future<AuthResult> setPassword(String token,String password)async {sets++;return const AuthResult(ok:true,message:'Password created.');}
  @override Future<AuthResult> changePassword(String token,String old,String fresh)async=>const AuthResult(ok:true,message:'Password changed. Sign in again.');
  @override Future<AuthResult> requestPasswordRecovery(String email)async=>const AuthResult(ok:true,message:'Recovery requested.');
  @override Future<AuthResult> localPasswordRecoveryCode(String email)async=>const AuthResult(ok:true,message:'Outbox ready.',code:'123456');
  @override Future<AuthResult> resetPassword(String email,String code,String fresh)async {resets++;return const AuthResult(ok:true,message:'Password reset. Sign in again.');}
  @override Future<AuthResult> requestSignupCode(String email) async {signupCodeRequests++;return const AuthResult(ok:true,message:'Signup code requested.');}
  @override Future<AuthResult> registerAccount({required String email,required String code,required String dateOfBirth,required bool consent,required String password}) async {signups++;return const AuthResult(ok:true,message:'Account created. You are signed in.',token:'signup-token',uniqueId:'same-uid',newAccount:true);}
  @override Future<AuthResult> requestCode(String email)async=>const AuthResult(ok:true,message:'Code requested.');
  @override Future<AuthResult> localOutboxCode(String email)async=>const AuthResult(ok:true,message:'Code retrieved.',code:'123456');
  @override Future<AuthResult> verify({required String email,required String code,required String dateOfBirth,required bool consent})async {
    otpLogins++;
    lastOtpEmail=email;
    lastOtpCode=code;
    return AuthResult(ok:true,message:'Signed in.',token:'otp-token',uniqueId:'same-uid',newAccount:newAccount);
  }
  @override Future<AuthResult> me(String token)async=>const AuthResult(ok:true,message:'Account access confirmed.',uniqueId:'same-uid');
  @override Future<AuthResult> logout(String token)async=>const AuthResult(ok:true,message:'Signed out.');
}
// Backend-free widget regression for the exact owner-reported device failure:
// after a successful password change, reject the old password and accept the
// new one through the real Flutter text fields and buttons.
class PasswordTransitionFake extends PasswordFake {
  String activePassword = 'Original example passphrase 2026';
  final loginInputs = <(String, String)>[];

  @override
  Future<AuthResult> passwordLogin(String email, String password) async {
    loginInputs.add((email, password));
    if (password != activePassword) {
      return const AuthResult(ok: false, message: 'Incorrect email or password.');
    }
    return const AuthResult(ok: true, message: 'Signed in with password.',
        token: 'fake-token', uniqueId: 'same-uid');
  }

  @override
  Future<AuthResult> changePassword(String token, String old, String fresh) async {
    if (old != activePassword) {
      return const AuthResult(ok: false, message: 'Incorrect email or password.');
    }
    activePassword = fresh;
    return const AuthResult(ok: true, message: 'Password changed. Sign in again.');
  }
}

void main(){
  testWidgets('P01-2 password login is the primary flow; logout restores screen', (tester)async{
    final service=PasswordFake();
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:service)));
    expect(find.byKey(const Key('auth-password-login')),findsOneWidget);
    await tester.enterText(find.byKey(const Key('auth-email')),'test@example.invalid');
    await tester.enterText(find.byKey(const Key('auth-password')),'Hello@123');
    await tester.tap(find.byKey(const Key('auth-password-login')));await tester.pumpAndSettle();
    expect(service.logins,1);expect(find.textContaining('same-uid'),findsOneWidget);
    expect(find.byKey(const Key('auth-create-password')),findsNothing);
    expect(find.byKey(const Key('auth-confirm-password')),findsNothing);
    expect(find.byKey(const Key('auth-current-password')),findsNothing);
    expect(find.byKey(const Key('auth-new-password')),findsNothing);
    await tester.ensureVisible(find.byKey(const Key('auth-password-settings')));
    await tester.tap(find.byKey(const Key('auth-password-settings')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-current-password')),findsOneWidget);
    expect(find.byKey(const Key('auth-new-password')),findsOneWidget);
    expect(find.byKey(const Key('auth-create-password')),findsNothing);
    expect(find.byKey(const Key('auth-confirm-password')),findsNothing);
    await tester.ensureVisible(find.byKey(const Key('auth-password-back')));
    await tester.tap(find.byKey(const Key('auth-password-back')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-current-password')),findsNothing);
    await tester.ensureVisible(find.byKey(const Key('auth-logout')));
    await tester.tap(find.byKey(const Key('auth-logout')));await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-password-login')),findsOneWidget);
  });
  testWidgets('P01-2 sign-up requires OTP then creates password atomically before account', (tester) async {
    final service=PasswordFake();
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:service)));
    await tester.tap(find.byKey(const Key('auth-mode-signup')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-create-password')),findsNothing);
    await tester.enterText(find.byKey(const Key('auth-email')),'new@example.invalid');
    await tester.tap(find.byKey(const Key('auth-request')));
    await tester.pumpAndSettle();
    expect(service.signupCodeRequests,1);
    await tester.enterText(find.byKey(const Key('auth-code')),'123456');
    expect(find.byKey(const Key('auth-create-password')),findsOneWidget);
    expect(find.byKey(const Key('auth-confirm-password')),findsOneWidget);
    expect(find.byKey(const Key('auth-current-password')),findsNothing);
    await tester.ensureVisible(find.byKey(const Key('auth-dob')));
    await tester.tap(find.byKey(const Key('auth-dob')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('auth-consent')));
    await tester.tap(find.byKey(const Key('auth-consent')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('auth-create-password')),'Long password example 2026');
    await tester.enterText(find.byKey(const Key('auth-confirm-password')),'Long password example 2026');
    await tester.ensureVisible(find.byKey(const Key('auth-signup-register')));
    await tester.tap(find.byKey(const Key('auth-signup-register')));
    await tester.pumpAndSettle();
    expect(service.signups,1);
    expect(service.sets,0,reason:'A new signup commits password with registration, not via second request');
    expect(find.byKey(const Key('auth-create-password')),findsNothing);
    expect(find.byKey(const Key('auth-current-password')),findsNothing);
    expect(find.byKey(const Key('auth-me')),findsOneWidget);
  });

  testWidgets('P01-2 existing OTP user goes to account rather than password setup', (tester) async {
    final service=PasswordFake()..newAccount=false;
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:service)));
    await tester.tap(find.byKey(const Key('auth-mode-otp')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('auth-email')),'existing@example.invalid');
    await tester.tap(find.byKey(const Key('auth-request')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('auth-code')),'123456');
    expect(find.byKey(const Key('auth-dob')),findsNothing);
    expect(find.byKey(const Key('auth-consent')),findsNothing);
    expect(find.text('Log in with email code'),findsOneWidget);
    // Let keyboard dismissal and ensureVisible scrolling finish before the tap.
    // Otherwise a tap during scroll can leave the test on the login page.
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    final verifyButton=find.byKey(const Key('auth-verify'));
    await tester.ensureVisible(verifyButton);
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(verifyButton).onPressed,isNotNull,
      reason:'Existing-account OTP submit must enable after six digits.');
    await tester.tap(verifyButton);
    await tester.pumpAndSettle();
    expect(service.otpLogins,1,
      reason:'The actual Email code button must invoke OTP verification.');
    expect(service.lastOtpEmail,'existing@example.invalid');
    expect(service.lastOtpCode,'123456');
    expect(find.byKey(const Key('auth-me')),findsOneWidget,
      reason:'Existing-user OTP login must open account, not password setup.');
    expect(find.byKey(const Key('auth-create-password')),findsNothing);
    expect(find.byKey(const Key('auth-current-password')),findsNothing);
    await tester.tap(find.byKey(const Key('auth-password-settings')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-open-create-password')),findsOneWidget);
    expect(find.byKey(const Key('auth-open-change-password')),findsOneWidget);
  });

  testWidgets('P01-2 recovery requests code and resets password', (tester)async{
    final service=PasswordFake();
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:service)));
    await tester.tap(find.byKey(const Key('auth-mode-recovery')));await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('auth-email')),'test@example.invalid');
    await tester.tap(find.byKey(const Key('auth-recovery-request')));await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('auth-recovery-outbox')));await tester.pumpAndSettle();
    expect(find.textContaining('123456'),findsOneWidget);
    await tester.enterText(find.byKey(const Key('auth-recovery-code')),'123456');
    await tester.enterText(find.byKey(const Key('auth-recovery-password')),'New password example 2026');
    await tester.enterText(find.byKey(const Key('auth-recovery-confirm')),'New password example 2026');
    await tester.ensureVisible(find.byKey(const Key('auth-recovery-reset')));
    await tester.tap(find.byKey(const Key('auth-recovery-reset')));await tester.pumpAndSettle();
    expect(service.resets,1);expect(find.byKey(const Key('auth-password-login')),findsOneWidget);
  });

  testWidgets('P01-2 post-change old-password failure does not corrupt next valid login input', (tester) async {
    const email = 'transition@example.invalid';
    const original = 'Original example passphrase 2026';
    const updated = 'Updated example passphrase 2026';
    final service = PasswordTransitionFake();
    await tester.pumpWidget(MaterialApp(home: AuthScreen(service: service)));
    await tester.enterText(find.byKey(const Key('auth-email')), email);
    await tester.enterText(find.byKey(const Key('auth-password')), original);
    await tester.ensureVisible(find.byKey(const Key('auth-password-login')));
    await tester.tap(find.byKey(const Key('auth-password-login')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-me')), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('auth-password-settings')));
    await tester.tap(find.byKey(const Key('auth-password-settings')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('auth-current-password')), original);
    await tester.enterText(find.byKey(const Key('auth-new-password')), updated);
    await tester.ensureVisible(find.byKey(const Key('auth-password-change')));
    await tester.tap(find.byKey(const Key('auth-password-change')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-password-login')), findsOneWidget);
    await tester.enterText(find.byKey(const Key('auth-password')), original);
    await tester.ensureVisible(find.byKey(const Key('auth-password-login')));
    await tester.tap(find.byKey(const Key('auth-password-login')));
    await tester.pumpAndSettle();
    expect(find.text('Incorrect email or password.'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('auth-password')), updated);
    await tester.ensureVisible(find.byKey(const Key('auth-password-login')));
    await tester.tap(find.byKey(const Key('auth-password-login')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-me')), findsOneWidget);
    expect(find.byKey(const Key('auth-current-password')), findsNothing);
    expect(service.loginInputs.length, 3);
    expect(service.loginInputs[0].$1 == email && service.loginInputs[0].$2 == original, isTrue,
        reason: 'Initial UI login submitted unexpected values; no credentials logged.');
    expect(service.loginInputs[1].$1 == email && service.loginInputs[1].$2 == original, isTrue,
        reason: 'Old-password rejection submitted unexpected values; no credentials logged.');
    expect(service.loginInputs[2].$1 == email && service.loginInputs[2].$2 == updated, isTrue,
        reason: 'Updated-password login submitted unexpected values; no credentials logged.');
  });
}
