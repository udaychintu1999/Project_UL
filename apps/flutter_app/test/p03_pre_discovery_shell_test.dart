import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/account_navigation.dart';
import 'package:uluv/features/auth/auth_screen.dart';
import 'package:uluv/features/auth/auth_service.dart';
import 'package:uluv/features/geo/discovery_location_gate.dart';
import 'package:uluv/features/profiles/profile_models.dart';
import 'package:uluv/features/profiles/profile_service.dart';

class _Auth implements AuthService, PasswordAuthService {
  @override Future<AuthResult> me(String token) async => const AuthResult(ok:true, message:'OK');
  @override Future<AuthResult> logout(String token) async => const AuthResult(ok:true, message:'Logged out');
  @override Future<AuthResult> requestCode(String email) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> localOutboxCode(String email) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> verify({required String email, required String code,
    required String dateOfBirth, required bool consent}) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> passwordLogin(String email, String password) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> setPassword(String token, String password) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> changePassword(String token, String old, String fresh) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> requestPasswordRecovery(String email) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> localPasswordRecoveryCode(String email) async => const AuthResult(ok:false, message:'Not used');
  @override Future<AuthResult> resetPassword(String email, String code, String fresh) async => const AuthResult(ok:false, message:'Not used');
}

class _Profiles implements ProfileRepository {
  _Profiles(this.ready);
  bool ready;
  int reads=0;
  final empty = const ProfileDraft(mode:'dating', exists:false, version:0, displayName:'',
    bio:'', interests:[], intention:'', missing:[]);
  @override Future<ProfileResult<ProfileDashboard>> dashboard() async {
    reads++;
    return ProfileResult.success(ProfileDashboard(
      handle:'user', identityRevision:1, locality:'India',
      shared: const SharedProfile(commonName:'Example', locality:'India',
        gender:'woman', setupRevision:1, dating:true, friendship:true),
      onboarding:OnboardingStatus(ready:ready, missing:ready?const []:const ['dating.photos']),
      profiles:{'dating':empty, 'friendship':empty},
    ));
  }
  @override Future<ProfileResult<ProfileDashboard>> saveSetup(int revision, {
    required String commonName, required String locality, required String gender,
    required bool dating, required bool friendship}) => dashboard();
  @override Future<ProfileResult<ProfileDraft>> saveDraft(String mode,int version,{
    required String displayName,required String bio,required List<String> interests,
    required String intention}) async => ProfileResult.success(empty);
  @override Future<ProfileResult<String>> saveHandle(String handle,int revision) async =>
    const ProfileResult.success('user');
  @override Future<ProfileResult<ProfileDashboard>> setModeActivation(String mode,int version,bool active) => dashboard();
  @override Future<ProfileResult<Map<String,dynamic>>> ownerPreview(String mode) async =>
    const ProfileResult.success(<String,dynamic>{});
}

void main() {
  testWidgets('incomplete profile keeps Home + Settings, not premature discovery', (tester) async {
    final profiles=_Profiles(false);
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:_Auth(),
      initialToken:'test-session', initialUid:'test-user', bottomNavigation:true,
      profileRepository:profiles)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds:200));
    expect(profiles.reads, greaterThanOrEqualTo(1));
    expect(find.byType(NavigationDestination), findsNWidgets(2));
    expect(find.byKey(const Key('p03-tab-dating')), findsNothing);
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pump();
    expect(find.byKey(const Key('auth-password-settings')), findsOneWidget);
    expect(find.byKey(const Key('auth-logout')), findsOneWidget);
    expect(find.byKey(const Key('p03-settings-open-profile')), findsNothing);
  });

  testWidgets('server-ready profile shows five tabs and summary, not onboarding editor', (tester) async {
    final profiles=_Profiles(true);
    await tester.pumpWidget(MaterialApp(home:AuthScreen(service:_Auth(),
      initialToken:'test-session',initialUid:'test-user',bottomNavigation:true,
      profileRepository:profiles)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds:200));
    expect(profiles.reads, greaterThanOrEqualTo(1));
    expect(find.byType(NavigationDestination), findsNWidgets(5));
    expect(find.byKey(const Key('p02-setup-ready')), findsOneWidget);
    expect(find.byKey(const Key('p02-step-label')), findsNothing);
    expect(find.byKey(const Key('p03-tab-dating')), findsOneWidget);
    expect(find.byKey(const Key('p03-tab-friendship')), findsOneWidget);
    expect(find.byKey(const Key('p03-tab-local-feed')), findsOneWidget);
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pump();
    expect(find.byKey(const Key('p03-settings-open-profile')), findsOneWidget);
    expect(find.text('Future settings'), findsOneWidget);
  });

  testWidgets('missing location presents GPS and manual, saved location hides setup', (tester) async {
    Map<String,dynamic> response={'settingsRevision':0,'location':null};
    var reads=0;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:DiscoveryLocationGate(
      mode:'dating',baseUrl:'http://127.0.0.1:3000',active:true,
      refreshEpoch:0,access:() async=>'fake-token',onLocationSaved:(_){},
      testReadLocation:() async {reads++; return response;},
    ))));
    await tester.pump();
    await tester.pump(const Duration(milliseconds:100));
    expect(reads, 1);
    expect(find.byKey(const Key('p03-location-required')), findsOneWidget);
    expect(find.byKey(const Key('p03-gps-capture')), findsOneWidget);
    expect(find.byKey(const Key('p03-discovery-manual')), findsOneWidget);
    response={'settingsRevision':1,'location':{'name':'Example Town','source':'manual_geonames'}};
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:DiscoveryLocationGate(
      mode:'dating',baseUrl:'http://127.0.0.1:3000',active:true,
      refreshEpoch:1,access:() async=>'fake-token',onLocationSaved:(_){},
      testReadLocation:() async {reads++; return response;},
    ))));
    await tester.pump();
    await tester.pump(const Duration(milliseconds:100));
    expect(reads, 2);
    expect(find.text('Example Town'), findsOneWidget);
    expect(find.byKey(const Key('p03-location-required')), findsNothing);
    expect(find.byKey(const Key('p03-discovery-manual')), findsNothing);
  });

  testWidgets('five-tab shell keeps existing home and Settings indices stable', (tester) async {
    var selected=0;
    await tester.pumpWidget(MaterialApp(home:StatefulBuilder(builder:(context,update)=>
      AccountNavigation(selectedIndex:selected,onSelect:(n)=>update(()=>selected=n),
        onBack:()=>update(()=>selected=0),profileComplete:true,
        home:const Text('Home content'),settings:const Text('Settings content'),
        dating:const Text('Dating content'),friendship:const Text('Friendship content'),
        localFeed:const Text('Local feed content')))));
    expect(find.byType(NavigationDestination), findsNWidgets(5));
    await tester.tap(find.byKey(const Key('p03-tab-local-feed')));
    await tester.pump();
    expect(selected, 3);
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await tester.pump();
    expect(selected,4);
  });
}
