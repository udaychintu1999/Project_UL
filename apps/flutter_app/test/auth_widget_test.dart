import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/auth_screen.dart';
import 'package:uluv/features/auth/auth_service.dart';

class FakeAuthService implements AuthService {
  int requests=0;
  @override Future<AuthResult> requestCode(String email) async {requests++;return const AuthResult(ok:true,message:'Local OTP requested');}
  @override Future<AuthResult> localOutboxCode(String email) async => const AuthResult(ok:true,message:'Local test only',code:'012345');
  @override Future<AuthResult> verify({required String email,required String code,required String dateOfBirth,required bool consent}) async => const AuthResult(ok:true,message:'Signed in',token:'synthetic-test-token',uniqueId:'fixture-uid');
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
    await tester.ensureVisible(find.byKey(const Key('auth-dob')));
    await tester.tap(find.byKey(const Key('auth-dob')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('auth-consent')));
    await tester.tap(find.byKey(const Key('auth-consent')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('auth-verify')));
    await tester.tap(find.byKey(const Key('auth-verify')));
    await tester.pumpAndSettle();
    expect(find.textContaining('fixture-uid'),findsOneWidget);
    await tester.tap(find.byKey(const Key('auth-logout')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-email')),findsOneWidget);
  });
}
