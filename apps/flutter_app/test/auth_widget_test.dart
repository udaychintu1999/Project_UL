import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/auth_screen.dart';
import 'package:uluv/features/auth/auth_service.dart';

class FakeAuthService implements AuthService {
  int requests=0, verifies=0;
  String? lastVerifiedEmail, lastVerifiedCode;
  @override Future<AuthResult> requestCode(String email) async {requests++;return const AuthResult(ok:true,message:'Local OTP requested');}
  @override Future<AuthResult> localOutboxCode(String email) async => const AuthResult(ok:true,message:'Local test only',code:'012345');
  @override Future<AuthResult> verify({required String email,required String code,required String dateOfBirth,required bool consent}) async {
    verifies++;
    lastVerifiedEmail=email;
    lastVerifiedCode=code;
    return const AuthResult(ok:true,message:'Signed in',token:'synthetic-test-token',uniqueId:'fixture-uid');
  }
  @override Future<AuthResult> me(String token) async => const AuthResult(ok:true,message:'Account accessible',uniqueId:'fixture-uid');
  @override Future<AuthResult> logout(String token) async => const AuthResult(ok:true,message:'Signed out');
}

class PendingOutboxService extends FakeAuthService {
  final Completer<AuthResult> pending=Completer<AuthResult>();
  @override Future<AuthResult> localOutboxCode(String email)=>pending.future;
}

void main() {
  testWidgets('P01 pending local outbox disables repeat taps and displays API denial', (tester) async {
    final service=PendingOutboxService();
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:service)));
    await tester.enterText(find.byKey(const Key('auth-email')),'pending@example.invalid');
    await tester.tap(find.byKey(const Key('auth-request')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('auth-outbox')));
    await tester.tap(find.byKey(const Key('auth-outbox')));
    await tester.pump();
    expect(find.text('Working...'),findsOneWidget);
    expect(tester.widget<OutlinedButton>(find.byKey(const Key('auth-outbox'))).onPressed,isNull);
    service.pending.complete(const AuthResult(ok:false,message:'Local developer access denied.'));
    await tester.pumpAndSettle();
    expect(find.text('Local developer access denied.'),findsOneWidget);
    expect(find.byKey(const Key('auth-local-code')),findsNothing);
    expect(tester.widget<OutlinedButton>(find.byKey(const Key('auth-outbox'))).onPressed,isNotNull);
  });

  testWidgets('P01 narrow device viewport still builds outbox code widget', (tester) async {
    tester.view.physicalSize=const Size(320,480);
    tester.view.devicePixelRatio=1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    final service=FakeAuthService();
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:service)));
    await tester.enterText(find.byKey(const Key('auth-email')),'narrow@example.invalid');
    await tester.tap(find.byKey(const Key('auth-request')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('auth-outbox')));
    await tester.tap(find.byKey(const Key('auth-outbox')));
    await tester.pumpAndSettle();
    final codeWidget=find.byKey(const Key('auth-local-code'));
    expect(codeWidget,findsOneWidget);
    expect(tester.widget<SelectableText>(codeWidget).data,'Local test code: 012345');
  });

  testWidgets('P01 email request, local code, sign in and logout are functional', (tester) async {
    final service=FakeAuthService();
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:service)));
    await tester.enterText(find.byKey(const Key('auth-email')),'example@example.com');
    await tester.tap(find.byKey(const Key('auth-request')));
    await tester.pumpAndSettle();
    expect(service.requests,1);
    await tester.tap(find.byKey(const Key('auth-outbox')));
    await tester.pumpAndSettle();
    expect(find.textContaining('012345'),findsOneWidget);
    await tester.enterText(find.byKey(const Key('auth-code')),'012345');
    expect(find.byKey(const Key('auth-dob')),findsNothing);
    expect(find.byKey(const Key('auth-consent')),findsNothing);
    // A scroll animation may still be intercepting taps when ensureVisible completes.
    // Dismiss input focus and settle the scroll before a real button tap.
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    final verifyButton=find.byKey(const Key('auth-verify'));
    await tester.ensureVisible(verifyButton);
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(verifyButton).onPressed,isNotNull,
      reason:'Email-code verification should be enabled after six digits.');
    await tester.tap(verifyButton);
    await tester.pumpAndSettle();
    expect(service.verifies,1,
      reason:'The real Verify button tap must invoke the authentication service.');
    expect(service.lastVerifiedEmail,'example@example.com');
    expect(service.lastVerifiedCode,'012345');
    expect(find.byKey(const Key('auth-me')),findsOneWidget,
      reason:'A successful existing-user OTP login must display account actions.');
    expect(find.textContaining('fixture-uid'),findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('auth-logout')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('auth-logout')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-email')),findsOneWidget);
  });
}
