// Physical Android: real Keystore, sealed store, Fastify and DynamoDB Local.
// No mock server, no real user, no emailed OTP; the host provisions a disposable account.
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:uluv/features/auth/auth_service.dart';
import 'package:uluv/features/auth/persistent_session.dart';

void main(){
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const base=String.fromEnvironment('ULUV_API_BASE_URL',defaultValue:'http://127.0.0.1:3000');
  const dev=String.fromEnvironment('ULUV_DEV_TOKEN',defaultValue:'');
  const email=String.fromEnvironment('ULUV_P01_3_FIXTURE_EMAIL',defaultValue:'');
  const password=String.fromEnvironment('ULUV_P01_3_FIXTURE_PASSWORD',defaultValue:'');
  const uid=String.fromEnvironment('ULUV_P01_3_FIXTURE_UID',defaultValue:'');
  testWidgets('P01-3 real Android device enroll, Keystore, restart restore, rotate and logout',(tester) async {
    expect(email,startsWith('p01-2-device-'));
    final api=HttpAuthService(baseUrl:base,devToken:dev);
    final network=const DeviceSessionApi(base);
    final vault=const AndroidDeviceVault();
    // Always start from clean local test storage; never use a real user's account.
    final existing=await tester.runAsync(()=>vault.read());
    expect(existing,isNull,reason:'P01-3 E2E requires fresh test-app storage; do not overwrite an existing saved login.');
    final signedIn=await tester.runAsync(()=>api.passwordLogin(email,password));
    expect(signedIn,isNotNull);expect(signedIn!.ok,isTrue);expect(signedIn.uniqueId,uid);
    final first=PersistentSessionController(vault:vault,api:network);
    await tester.runAsync(()=>first.enroll(signedIn.token!,uid));
    expect(first.stage,SessionStage.authenticated);
    expect(first.record?.generation,0);
    expect(first.accessToken,isNotNull);
    // A fresh Dart controller simulates loss of all process-local state.
    final relaunched=PersistentSessionController(vault:vault,api:network);
    await tester.runAsync(()=>relaunched.restore());
    expect(relaunched.stage,SessionStage.authenticated);
    expect(relaunched.record?.uid,uid);
    expect(relaunched.record?.generation,1);
    final account=await tester.runAsync(()=>api.me(relaunched.accessToken!));
    expect(account!.ok,isTrue);expect(account.uniqueId,uid);
    final next=PersistentSessionController(vault:vault,api:network);
    await tester.runAsync(()=>next.restore());
    expect(next.stage,SessionStage.authenticated);
    expect(next.record?.generation,2);
    await tester.runAsync(()=>next.signOut());
    expect(next.stage,SessionStage.signedOut);
    final after=PersistentSessionController(vault:vault,api:network);
    await tester.runAsync(()=>after.restore());
    expect(after.stage,SessionStage.signedOut);
    expect(after.accessToken,isNull);
  });
}
